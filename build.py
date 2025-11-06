"""
依赖构建脚本 - 用于从 Git 仓库或 Release 获取提交器依赖
优先选择非源码的 Release 包
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
import tarfile
import stat
import urllib3
from pathlib import Path
from urllib.parse import urlparse
try:
    import requests
    from requests.adapters import HTTPAdapter
    from requests.packages.urllib3.util.retry import Retry # pyright: ignore[reportMissingImports]
except ImportError:
    print("错误: 需要 requests 库，请运行: pip install requests")
    sys.exit(1)

# 禁用 SSL 警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def remove_readonly(func, path, _):
    """在 Windows 上删除只读文件"""
    os.chmod(path, stat.S_IWRITE)
    func(path)


def create_requests_session():
    """创建带重试机制的 requests session"""
    session = requests.Session()
    
    # 设置重试策略
    retry_strategy = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
    )
    
    # 适配器，禁用 SSL 验证
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    
    return session


class DependencyBuilder:
    def __init__(self, config_path):
        # 项目根目录是 build.py 所在的目录
        self.project_root = Path(__file__).parent
        # 配置文件路径
        self.config_path = self.project_root / config_path
        self.config = None
        self.session = create_requests_session()
        
    def load_config(self):
        """加载配置文件"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                self.config = json.load(f)
            print(f"✅ 已加载配置文件: {self.config_path}")
            return True
        except Exception as e:
            print(f"❌ 加载配置文件失败: {e}")
            return False
    
    def ensure_target_dir(self, target_path):
        """确保目标目录存在"""
        full_path = self.project_root / "Better-Names-for-7FA4" / "submitter" / target_path
        full_path.mkdir(parents=True, exist_ok=True)
        return full_path
    
    def run_command(self, cmd, cwd=None):
        """运行 shell 命令"""
        try:
            result = subprocess.run(
                cmd, 
                shell=True, 
                cwd=cwd, 
                capture_output=True, 
                text=True,
                encoding='utf-8'
            )
            if result.returncode != 0:
                print(f"❌ 命令执行失败: {cmd}")
                print(f"错误输出: {result.stderr}")
                return False
            return True
        except Exception as e:
            print(f"❌ 执行命令时出错: {e}")
            return False
    
    def safe_rmtree(self, path):
        """安全删除目录（处理 Windows 权限问题）"""
        if not path.exists():
            return
        
        # 确保路径是字符串
        path_str = str(path)
        
        # 在 Windows 上，我们需要处理只读文件
        if sys.platform == "win32":
            # 首先尝试正常删除
            try:
                shutil.rmtree(path_str)
                return
            except PermissionError:
                # 如果失败，使用 onerror 处理只读文件
                try:
                    shutil.rmtree(path_str, onerror=remove_readonly)
                    return
                except Exception as e:
                    print(f"⚠️ 无法删除目录 {path_str}: {e}")
        else:
            # 在 Unix 系统上正常删除
            try:
                shutil.rmtree(path_str)
            except Exception as e:
                print(f"⚠️ 无法删除目录 {path_str}: {e}")
    
    def clone_git_repo(self, repo_url, target_dir, ref=None):
        """克隆 Git 仓库"""
        if target_dir.exists():
            print(f"🗑️ 删除已存在的目录: {target_dir}")
            self.safe_rmtree(target_dir)
        
        # 克隆仓库
        cmd = f'git clone "{repo_url}" "{target_dir}"'
        if not self.run_command(cmd):
            return False
        
        # 如果指定了 ref，切换到指定分支/标签
        if ref:
            cmd = f'git checkout {ref}'
            if not self.run_command(cmd, cwd=target_dir):
                print(f"⚠️ 无法切换到 {ref}，使用默认分支")
        
        # 移除 .git 目录以减小体积（使用安全删除）
        git_dir = target_dir / ".git"
        if git_dir.exists():
            print(f"🗑️ 移除 .git 目录")
            self.safe_rmtree(git_dir)
        
        print(f"✅ 成功克隆仓库到: {target_dir}")
        return True
    
    def get_latest_release_info(self, repo_url):
        """获取最新 release 信息"""
        parsed_url = urlparse(repo_url)
        
        # 只允许真正的 github.com 域名（不允许类似 evil-github.com.xyz）
        if parsed_url.hostname and parsed_url.hostname.lower() == "github.com":
            # GitHub 仓库
            path_parts = parsed_url.path.strip('/').split('/')
            if len(path_parts) < 2:
                print(f"❌ 无效的 GitHub 仓库 URL: {repo_url}")
                return None
            
            owner, repo = path_parts[0], path_parts[1]
            api_url = f"https://api.github.com/repos/{owner}/{repo}/releases/latest"
            
            try:
                headers = {}
                # 使用 GitHub Token 如果存在
                github_token = os.environ.get('GITHUB_TOKEN')
                if github_token:
                    headers['Authorization'] = f'token {github_token}'
                
                print(f"📡 获取 GitHub release 信息: {api_url}")
                # 禁用 SSL 验证
                response = self.session.get(api_url, headers=headers, timeout=30, verify=False)
                response.raise_for_status()
                release_data = response.json()
                print(f"✅ 找到 release: {release_data.get('tag_name', 'unknown')}")
                return release_data
            except requests.RequestException as e:
                print(f"❌ 获取 GitHub release 信息失败: {e}")
                return None
                
        elif "jx.7fa4.cn" in repo_url:
            # GitLab 仓库
            path_parts = parsed_url.path.strip('/').split('/')
            project_path = '/'.join(path_parts)
            
            # 对项目路径进行 URL 编码
            import urllib.parse
            encoded_project_path = urllib.parse.quote(project_path, safe='')
            
            api_url = f"http://jx.7fa4.cn:9080/api/v4/projects/{encoded_project_path}/releases"
            
            try:
                headers = {}
                gitlab_token = os.environ.get('GITLAB_TOKEN')
                if gitlab_token:
                    headers['PRIVATE-TOKEN'] = gitlab_token
                
                print(f"📡 获取 GitLab release 信息: {api_url}")
                response = self.session.get(api_url, headers=headers, timeout=30, verify=False)
                response.raise_for_status()
                releases = response.json()
                if releases:
                    latest_release = releases[0]  # 最新 release
                    print(f"✅ 找到 release: {latest_release.get('tag_name', 'unknown')}")
                    return latest_release
                else:
                    print(f"❌ 未找到 release: {repo_url}")
                    return None
            except requests.RequestException as e:
                print(f"❌ 获取 GitLab release 信息失败: {e}")
                return None
        else:
            print(f"❌ 不支持的仓库类型: {repo_url}")
            return None
    
    def select_best_asset(self, assets, release_info, repo_url):
        """选择最佳的 asset（优先非源码包）"""
        # GitHub 和 GitLab 的 assets 结构不同
        host = urlparse(repo_url).hostname
        if host == "github.com":
            # GitHub: assets 是列表
            asset_list = assets
        else:
            # GitLab: assets 可能有 links
            asset_list = assets.get("links", []) if isinstance(assets, dict) else assets
        
        if not asset_list:
            # 如果没有 assets，使用源码包
            if release_info.get("tarball_url"):
                return release_info["tarball_url"], "source.tar.gz"
            elif release_info.get("zipball_url"):
                return release_info["zipball_url"], "source.zip"
            return None, None
        
        print(f"🔍 分析 {len(asset_list)} 个可用资源")
        
        # 优先选择非源码包
        non_source_assets = []
        source_assets = []
        
        for asset in asset_list:
            if host == "github.com":
                name = asset.get("name", "").lower()
                url = asset.get("browser_download_url", "")
            else:
                # GitLab
                name = asset.get("name", "").lower()
                url = asset.get("url", asset.get("direct_asset_url", ""))
            
            if not name or not url:
                continue
                
            print(f"  📦 发现资源: {name}")
            
            # 排除源码包
            if any(keyword in name for keyword in ["source", "src"]):
                source_assets.append((url, name))
            else:
                non_source_assets.append((url, name))
        
        # 优先返回非源码包
        if non_source_assets:
            selected_url, selected_name = non_source_assets[0]
            print(f"✅ 选择非源码包: {selected_name}")
            return selected_url, selected_name
        elif source_assets:
            selected_url, selected_name = source_assets[0]
            print(f"⚠️ 使用源码包: {selected_name}")
            return selected_url, selected_name
        else:
            # 回退到第一个 asset
            if asset_list and host == "github.com":
                selected_url = asset_list[0].get("browser_download_url")
                selected_name = asset_list[0].get("name")
            elif asset_list:
                selected_url = asset_list[0].get("url")
                selected_name = asset_list[0].get("name")
            else:
                return None, None
            print(f"⚠️ 使用默认包: {selected_name}")
            return selected_url, selected_name
    
    def download_and_extract_release(self, release_info, target_dir, repo_url):
        """下载并解压 release，优先选择非源码包"""
        if target_dir.exists():
            print(f"🗑️ 删除已存在的目录: {target_dir}")
            self.safe_rmtree(target_dir)
        
        # 获取 assets
        assets = []
        if "assets" in release_info:
            assets = release_info["assets"]
        
        # 选择最佳的 asset
        download_url, asset_name = self.select_best_asset(assets, release_info, repo_url)
        
        if not download_url:
            print("❌ 未找到可下载的 release 资源")
            return False
        
        # 下载文件
        print(f"📥 下载: {asset_name}")
        print(f"   URL: {download_url}")
        try:
            headers = {}
            
            # 设置认证头
            host = urlparse(repo_url).hostname
            if host == "github.com" or (host and host.endswith(".github.com")):
                github_token = os.environ.get('GITHUB_TOKEN')
                if github_token:
                    headers['Authorization'] = f'token {github_token}'
            elif host == "jx.7fa4.cn" or (host and host.endswith(".jx.7fa4.cn")):
                gitlab_token = os.environ.get('GITLAB_TOKEN')
                if gitlab_token:
                    headers['PRIVATE-TOKEN'] = gitlab_token
            
            # 禁用 SSL 验证
            response = self.session.get(download_url, headers=headers, stream=True, timeout=60, verify=False)
            response.raise_for_status()
            
            # 创建临时文件
            temp_suffix = Path(asset_name).suffix
            if not temp_suffix:
                temp_suffix = '.zip'  # 默认使用 zip
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=temp_suffix) as tmp_file:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        tmp_file.write(chunk)
                temp_path = tmp_file.name
            
            # 解压文件
            print(f"📦 解压到: {target_dir}")
            target_dir.mkdir(parents=True, exist_ok=True)
            
            success = False
            try:
                if temp_path.endswith('.zip'):
                    with zipfile.ZipFile(temp_path, 'r') as zip_ref:
                        zip_ref.extractall(target_dir)
                    success = True
                elif temp_path.endswith(('.tar.gz', '.tgz')):
                    with tarfile.open(temp_path, 'r:gz') as tar_ref:
                        tar_ref.extractall(target_dir)
                    success = True
                elif temp_path.endswith(('.tar.bz2', '.tbz')):
                    with tarfile.open(temp_path, 'r:bz2') as tar_ref:
                        tar_ref.extractall(target_dir)
                    success = True
                elif temp_path.endswith('.tar'):
                    with tarfile.open(temp_path, 'r') as tar_ref:
                        tar_ref.extractall(target_dir)
                    success = True
                else:
                    print(f"⚠️ 不支持的文件格式: {temp_path}，尝试直接复制")
                    shutil.copy(temp_path, target_dir / asset_name)
                    success = True
            except Exception as e:
                print(f"❌ 解压失败: {e}")
                success = False
            
            # 清理临时文件
            try:
                os.unlink(temp_path)
            except:
                pass
            
            if success:
                print(f"✅ 成功下载并解压 release 到: {target_dir}")
                return True
            else:
                return False
            
        except Exception as e:
            print(f"❌ 下载或解压失败: {e}")
            return False
    
    def process_move_operations(self, submitter_id, target_dir, move_operations):
        """处理移动操作"""
        if not move_operations:
            return True
        
        print(f"📂 处理移动操作: {submitter_id}")
        
        for move_op in move_operations:
            from_path = target_dir / move_op["from"]
            to_path = self.project_root / "Better-Names-for-7FA4" / move_op["to"]
            
            if not from_path.exists():
                print(f"⚠️ 源路径不存在: {from_path}")
                # 尝试在解压目录中查找可能的子目录
                possible_dirs = list(target_dir.glob("*/wasm")) if "wasm" in str(from_path) else []
                if possible_dirs:
                    print(f"  可能的目标: {possible_dirs}")
                    from_path = possible_dirs[0]  # 使用第一个找到的目录
                    print(f"  使用替代路径: {from_path}")
                else:
                    continue
            
            # 确保目标目录存在
            to_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 处理移动/合并操作
            try:
                if from_path.is_file():
                    # 文件移动：如果目标文件已存在，覆盖它
                    if to_path.exists():
                        if to_path.is_file():
                            # 删除现有文件
                            to_path.unlink()
                        else:
                            # 目标是目录，删除整个目录
                            self.safe_rmtree(to_path)
                    shutil.move(str(from_path), str(to_path))
                    print(f"  ✅ 移动文件: {move_op['from']} -> {move_op['to']}")
                    
                elif from_path.is_dir():
                    # 目录移动：合并目录内容
                    if to_path.exists():
                        if to_path.is_file():
                            # 目标是文件但源是目录，先删除文件
                            to_path.unlink()
                            shutil.move(str(from_path), str(to_path))
                            print(f"  ✅ 移动目录(覆盖文件): {move_op['from']} -> {move_op['to']}")
                        else:
                            # 目标是目录，合并内容
                            self.merge_directories(from_path, to_path)
                            # 删除源目录
                            self.safe_rmtree(from_path)
                            print(f"  ✅ 合并目录: {move_op['from']} -> {move_op['to']}")
                    else:
                        # 目标不存在，直接移动
                        shutil.move(str(from_path), str(to_path))
                        print(f"  ✅ 移动目录: {move_op['from']} -> {move_op['to']}")
                        
            except Exception as e:
                print(f"  ❌ 移动失败 {move_op['from']} -> {move_op['to']}: {e}")
        
        return True

    def merge_directories(self, src_dir, dst_dir):
        """合并两个目录的内容"""
        for item in src_dir.iterdir():
            src_item = src_dir / item.name
            dst_item = dst_dir / item.name
            
            if src_item.is_file():
                # 如果是文件，覆盖目标文件
                if dst_item.exists():
                    dst_item.unlink()
                shutil.move(str(src_item), str(dst_item))
            elif src_item.is_dir():
                # 如果是目录，递归合并
                if dst_item.exists():
                    self.merge_directories(src_item, dst_item)
                else:
                    shutil.move(str(src_item), str(dst_item))

    def create_git_files(self, target_dir):
        """在目标目录下创建 .gitkeep 和 .gitignore 文件"""
        # 创建 .gitkeep 文件（空文件）
        gitkeep_path = target_dir / ".gitkeep"
        with open(gitkeep_path, 'w', encoding='utf-8') as f:
            pass  # 创建空文件
        
        # 创建 .gitignore 文件
        gitignore_path = target_dir / ".gitignore"
        with open(gitignore_path, 'w', encoding='utf-8') as f:
            f.write("*\n!*.gitkeep\n")
        
        print(f"  ✅ 在 {target_dir} 下创建 .gitkeep 和 .gitignore 文件")
    
    def build_dependency(self, submitter):
        """构建单个依赖项"""
        submitter_id = submitter["id"]
        package = submitter["package"]
        repo_url = package["repo"]
        target_path = package["target"]
        move_operations = package.get("move", [])
        
        print(f"\n🔨 构建提交器: {submitter['name']} ({submitter_id})")
        print(f"   类型: {package['type']}")
        print(f"   仓库: {repo_url}")
        print(f"   目标: {target_path}")
        
        # 确保目标目录存在
        target_dir = self.ensure_target_dir(target_path)
        
        if package["type"] == "git":
            # Git 克隆模式
            ref = package.get("ref")
            success = self.clone_git_repo(repo_url, target_dir, ref)
        elif package["type"] == "release":
            # Release 模式
            release_info = self.get_latest_release_info(repo_url)
            if not release_info:
                return False
            
            success = self.download_and_extract_release(release_info, target_dir, repo_url)
        else:
            print(f"❌ 不支持的包类型: {package['type']}")
            return False
        
        if success:
            # 处理移动操作
            self.process_move_operations(submitter_id, target_dir, move_operations)
        
            # 在目标目录下创建 .gitkeep 和 .gitignore 文件
            self.create_git_files(target_dir)
            
            print(f"✅ 成功构建: {submitter['name']}")
        else:
            print(f"❌ 构建失败: {submitter['name']}")
        
        return success
    
    def build_all(self):
        """构建所有依赖项"""
        if not self.load_config():
            return False
        
        print("🚀 开始构建所有提交器依赖...")
        
        success_count = 0
        total_count = 0
        
        for submitter in self.config["submitters"]:
            if not submitter.get("autoSync", True):
                print(f"  Skipping auto sync: {submitter['name']} ({submitter['id']})")
                continue
            
            total_count += 1
            if self.build_dependency(submitter):
                success_count += 1
        
        if total_count == 0:
            print("No submitters are marked for auto sync; nothing to build.")
            return True
        
        print(f"\n📊 构建完成: {success_count}/{total_count} 个提交器构建成功")
        
        if success_count == total_count:
            print("🎉 所有依赖构建成功!")
            return True
        else:
            print("⚠️ 部分依赖构建失败，请检查错误信息")
            return False
    
    def clean(self):
        """清理所有构建的依赖"""
        if not self.load_config():
            return False
        
        print("🧹 清理所有依赖...")
        
        for submitter in self.config["submitters"]:
            if not submitter.get("autoSync", True):
                print(f"  Skipping clean: {submitter['name']} ({submitter['id']})")
                continue
            
            target_path = submitter["package"]["target"]
            target_dir = self.project_root / "Better-Names-for-7FA4" / "submitter" / target_path
            
            if target_dir.exists():
                print(f"🗑️ 删除: {target_path}")
                self.safe_rmtree(target_dir)
            
            # 清理移动操作创建的文件
            move_operations = submitter["package"].get("move", [])
            for move_op in move_operations:
                to_path = self.project_root / "Better-Names-for-7FA4" / move_op["to"]
                if to_path.exists():
                    print(f"🗑️ 删除: {move_op['to']}")
                    if to_path.is_file():
                        try:
                            to_path.unlink()
                        except PermissionError:
                            os.chmod(str(to_path), stat.S_IWRITE)
                            to_path.unlink()
                    else:
                        self.safe_rmtree(to_path)
        
        print("✅ 清理完成")


def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("用法:")
        print("  python build.py build    # 构建所有依赖")
        print("  python build.py clean    # 清理所有依赖")
        print("  python build.py test     # 测试配置文件")
        sys.exit(1)
    
    command = sys.argv[1]
    builder = DependencyBuilder("Better-Names-for-7FA4/submitter/submitters.json")
    
    if command == "build":
        success = builder.build_all()
        sys.exit(0 if success else 1)
    elif command == "clean":
        builder.clean()
    elif command == "test":
        if builder.load_config():
            print("✅ 配置文件格式正确")
            print(f"找到 {len(builder.config['submitters'])} 个提交器")
            for submitter in builder.config["submitters"]:
                print(f"  - {submitter['name']} ({submitter['id']})")
    else:
        print(f"❌ 未知命令: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
