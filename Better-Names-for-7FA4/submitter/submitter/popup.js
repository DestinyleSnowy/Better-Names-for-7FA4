const host_list = [
	'oj.7fa4.cn', 'jx.7fa4.cn:8888', 'jx.7fa4.cn:5283', 'in.7fa4.cn:8888', 'in.7fa4.cn:5283', '10.210.57.10:8888', '10.210.57.10:5283', '211.137.101.118:8888', '211.137.101.118:5283'
];
const key_cookies = [
	'login', 'connect.sid'
];

function replaceLast(str, find, replace) {
	const lastIndex = str.lastIndexOf(find);
	if (lastIndex === -1) return str;
	return str.substring(0, lastIndex) + replace + str.substring(lastIndex + find.length);
}

function freshLoginStatus() {
	const a = document.getElementById('loginStatus');
	chrome.storage.sync.get("cookies", ({ cookies }) => {
		if(!cookies || !cookies.login || !cookies['connect.sid']) {
			a.innerHTML = '未登录';
		} else {
			let headers = new Headers({
				"Cookie": `login=${cookies.login}; connect.sid=${cookies['connect.sid']}`,
				"Content-Type": "application/json"
			});
			let current_host = cookies.chost;
			console.log(`http://${current_host}`);

			fetch(
				`http://${current_host}/user_api/json`, {
					headers: headers,
					method: 'GET',
				}
			).then(
				res => res.json()
			).then(
				json => {
					console.log(json)
					if(json.success) 
						a.innerHTML = '已登录  ' + json.user.nickname;
					else 
						a.innerHTML = '未登录';	
				}
			).catch(
				error => {
					a.innerHTML = '未登录';
					console.log(error);
				}
			)
		}
	});
}


document.getElementById('getCookies').addEventListener('click', async () => {
	let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	chrome.storage.sync.set({ tab });
	chrome.scripting.executeScript({
		target: { tabId: tab.id },
		function: () => chrome.runtime.sendMessage(
			{
				type: 'GCookies',
				cookies: document.cookie
			}
		)
	});
});

document.getElementById('sendPage').addEventListener('click', async () => {
	let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	chrome.storage.sync.set({ tab });
	chrome.scripting.executeScript({
		target: { tabId: tab.id },
		function: () => chrome.runtime.sendMessage(
			{
				html: document.documentElement.outerHTML,
				in_contest: false,
				type: 'Submit',
				vj_origin: true
			},
			(response) => console.log(response)
		)
	});
});

document.getElementById('sendVjPage').addEventListener('click', async () => {
	let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	chrome.storage.sync.set({ tab });
	chrome.scripting.executeScript({
		target: { tabId: tab.id },
		function: () => chrome.runtime.sendMessage(
			{
				html: document.documentElement.outerHTML,
				in_contest: false,
				type: 'Submit',
				vj_origin: false
			},
			(response) => console.log(response)
		)
	});
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if(request.type != 'GCookies') return;
	let window_host = sender.origin;
	let host;
	let cookie = request.cookies;
	function check_host() {
		for (let re of host_list)
			if (window_host.search(re) != -1){
				host = re;
				return true;
			}
		return false;
	}
	// 不同host的cookies不能通用，所以干脆只能使用一个host
	if (!check_host()) {
		alert('必须在7FA4的页面上才能保存登录信息。');
		return;
	}
	let cookies = {};
	cookies.chost = host;
	let inp = cookie.split(' ');
	for (let inpi of inp)
		for (let name of key_cookies)
			if(inpi.startsWith(name + '=')){
				if(inpi[inpi.length - 1] == ';')
					inpi = inpi.substring(0, inpi.length - 1);
				cookies[name] = inpi.substring(name.length + 1);
			}
	for (let name of key_cookies)
		if (!cookies[name]) {
			alert('没有登录7FA4，请先登录。');
			return;
		}
	chrome.storage.sync.set({ cookies });
	freshLoginStatus();
	alert('7FA4登录信息保存成功。');
})

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if(request.type != 'Submit') return '';
	let html = request.html;
	let in_contest = request.in_contest;
	let oj_urls = {
		luogu: /https:\/\/(?:www\.)?luogu\.com\.cn\/record\/(\d+)/,
		uoj: /https:\/\/(?:www\.)?uoj\.ac\/submission\/(\d+)/,
		qoj: /https:\/\/(?:www\.)?qoj\.ac\/submission\/(\d+)/,
		cf: /https:\/\/(?:www\.)?codeforces\.com\/contest\/\d+\/submission\/(\d+)/,
		cfgym: /https:\/\/(?:www\.)?codeforces\.com\/gym\/\d+\/submission\/(\d+)/,
		atc: /https:\/\/(?:www\.)?atcoder\.jp\/contests\/.+\/submissions\/(\d+)/,
		vj: /https:\/\/(?:www\.)?vjudge\.net\/solution\/(\d+)/,
		cc: /https:\/\/(?:www\.)?codechef\.com\/viewsolution\/(\d+)/,
		csa: /https:\/\/(?:www\.)?csacademy\.com\/contest\/archive\/task\/(.+)\/.+/,
		zr: /http:\/\/(?:www\.)?zhengruioi\.com\/submission\/(\d+)/,
		xyd: /https:\/\/(?:www\.)?xinyoudui\.com\/ac\/contest\/.*?\/problem\/(\d+)/,
		oifha: /https:\/\/(?:www\.)?oifha\.com\/d\/.+\/record\/(\w+)/,
		mx: /https:\/\/(?:www\.)?mna\.wang\/contest\/submission\/(\d+)/,
		'7fa4': /http:\/\/(?:jx)|(?:in)\.7fa4\.cn:8888\/submission\/(\d+)/,
	}
	let oj_host = {
		luogu: /https:\/\/(?:www\.)?luogu\.com\.cn/,
		uoj: /https:\/\/(?:www\.)?uoj\.ac/,
		qoj: /https:\/\/(?:www\.)?qoj\.ac/,
		cf: /https:\/\/(?:www\.)?codeforces\.com/,
		cfgym: /https:\/\/(?:www\.)?codeforces\.com/,
		atc: /https:\/\/(?:www\.)?atcoder\.jp/,
		vj: /https:\/\/(?:www\.)?vjudge\.net/,
		cc: /https:\/\/(?:www\.)?codechef\.com/,
		csa: /https:\/\/(?:www\.)?csacademy\.com/,
		zr: /http:\/\/(?:www\.)?zhengruioi\.com/,
		xyd: /https:\/\/(?:www\.)?xinyoudui\.com/,
		oifha: /https:\/\/(?:www\.)?oifha\.com/,
		mx: /https:\/\/(?:www\.)?mna\.wang/,
		'7fa4': /http:\/\/(?:jx)|(?:in)\.7fa4\.cn:8888/,
	}
	let deal_uoj = (oj) => (rid) => {
		let q = $(html);
		let td = q.find('.uoj-content tbody').find('td');
		let score = Number($(td[3]).text());
		return {
			code: q.find('code').text(),
			pid: $(td[1]).text().split('.')[0].substring(1),
			rid: rid,
			oj: oj,
			language: 'cpp17',
			status: score >= 100 - 1e-5 ? 'Accepted' : 'Wrong Answer',
			total_time: 0,
			max_memory: 0,
			score: score
		}
	}
	let ace_code = q => $.map(q.find(".ace_layer.ace_text-layer .ace_line"), x => $(x).text()).join('\n') + '\n';
	let oj_deal = {
		luogu: (rid) => {
			let q = $(html);
			let pre = q.find('pre');
			if(pre.length == 0){
				alert('请切换到“源代码”tab，然后再提交。');
				return false;
			}
			let rows = q.find('div.info-rows:contains(评测状态)');
			let st = $(rows.find('div:contains(评测状态)').find('span')[3]).text().trim();
			if(!st || st == 'Waiting' || st == 'Judging'){
				alert('结果还未显示，请刷新后提交。');
				return false;
			}
			let score_div = rows.find('div:contains(评测分数)').find('span')[3];
			let score;
			if(score_div)
				score = Number($(score_div).text());
			else
				score = (st == 'Accepted' ? 100 : 0);
			return {
				code: q.find('pre').text(),
				pid: $(rows.find('div:contains(所属题目)').find('span')[4]).text(),
				rid: rid,
				oj: 'luogu',
				language: 'cpp17',
				status: score >= 100 - 1e-5 ? 'Accepted' : 'Wrong Answer',
				total_time: 0,
				max_memory: 0,
				score: score
			}
		},
		uoj: deal_uoj('uoj'),
		zr: deal_uoj('zr'),
		mx: (rid) => {
			let q = $(html);
			let score = Number($(q.find('tbody').find('tr').find('td')[3]).text());
			let link = $(q.find('tbody tr td a')[0]).attr('href').split('/');
			let pid = link[2] + '_' + link[4];
			let result = score >= 100 - 1e-5 ? 'Accepted' : 'Wrong Answer';
			return {
				code: q.find('pre').text(),
				pid: pid,
				rid: rid,
				oj: 'mx',
				language: 'cpp17',
				status: result,
				total_time: 0,
				max_memory: 0,
				score: score
			}
		},
		qoj: (rid) => {
			let q = $(html);
			let td = q.find('tbody').find('td');
			let result_text = $(td[3]).text();
			let result = $(td[3]).text().split(' ')[0];
			let score = Number(result);
			if(isNaN(score)){
				score = result == 'AC' ? 100 : 0;
				result = score >= 100 - 1e-5 ? "Accepted" : "Wrong Answer";
			}else{
				result =  'Wrong Answer';
				for(let i = 0; i < result_text.length; ++i){
					if(result_text[i] == '✓') result = "Accepted";
				}
			}
			return {
				code: q.find('code').text(),
				pid: $(td[1]).text().split('.')[0].substring(1),
				rid: rid,
				oj: 'qoj',
				language: 'cpp17',
				status: result,
				total_time: 0,
				max_memory: 0,
				score: score
			}
		},
		cf: (rid) => {
			let q = $(html);
			let td = $($(q.find('tbody').find('tr')[1]).find('td'));
			let st = $(td[4]).text().trim();
			let code = '';
			for(let li of $(q.find('pre')[0]).find('li'))
				code += $(li).text() + '\n';
			let IOI_format_accepted = (score) => {
				return 'Perfect result: ' + String(score) + ' points'
			};
			let IOI_format_unaccepted = (score) => {
				return 'Partial result: ' + String(score) + ' points'
			};
			let checker = (usr) => {
				if(usr == 'Accepted') return {
					is_accepted: true,
					format: 'XCPC',
					score: 100
				};
				if(usr == 'Happy New Year!') return {
					is_accepted: true,
					format: 'XCPC',
					score: 100
				};
				for(let i = 0; i < 101; ++i) if(usr == IOI_format_accepted(i)) return {
					is_accepted: true,
					format: 'IOI',
					score: i
				};
				for(let i = 0; i < 101; ++i) if(usr == IOI_format_unaccepted(i)) return {
					is_accepted: false,
					format: 'IOI',
					score: i
				};
				return {
					is_accepted: false,
					format: 'XCPC',
					score: 0
				};
			};
			result = checker(st);
			if(result.format == 'IOI') return {
				code: code,
				pid: $(td[2]).find('a').text(),
				rid: rid,
				oj: 'cf',
				language: 'cpp17',
				status: result.is_accepted ? 'Accepted' : 'Partially Correct',
				total_time: 0,
				max_memory: 0,
				score: result.score
			}
			return {
				code: code,
				pid: $(td[2]).find('a').text(),
				rid: rid,
				oj: 'cf',
				language: 'cpp17',
				status: result.is_accepted ? 'Accepted' : 'Wrong Answer',
				total_time: 0,
				max_memory: 0,
				score: result.score
			}
		},
		cfgym: (rid) => {
			let q = $(html);
			let td = $($(q.find('tbody').find('tr')[1]).find('td'));
			let st = $(td[4]).text().trim();
			let code = '';
			for(let li of $(q.find('pre')[0]).find('li'))
				code += $(li).text() + '\n';
			let IOI_format_accepted = (score) => {
				return 'Perfect result: ' + String(score) + ' points'
			};
			let IOI_format_unaccepted = (score) => {
				return 'Partial result: ' + String(score) + ' points'
			};
			let checker = (usr) => {
				if(usr == 'Accepted') return {
					is_accepted: true,
					format: 'XCPC',
					score: 100
				};
				if(usr == 'Happy New Year!') return {
					is_accepted: true,
					format: 'XCPC',
					score: 100
				};
				for(let i = 0; i < 101; ++i) if(usr == IOI_format_accepted(i)) return {
					is_accepted: true,
					format: 'IOI',
					score: i
				};
				for(let i = 0; i < 101; ++i) if(usr == IOI_format_unaccepted(i)) return {
					is_accepted: false,
					format: 'IOI',
					score: i
				};
				return {
					is_accepted: false,
					format: 'XCPC',
					score: 0
				};
			};
			result = checker(st);
			if(result.format == 'IOI') return {
				code: code,
				pid: $(td[2]).find('a').text(),
				rid: rid,
				oj: 'cfgym',
				language: 'cpp17',
				status: result.is_accepted ? 'Accepted' : 'Partially Correct',
				total_time: 0,
				max_memory: 0,
				score: result.score
			}
			return {
				code: code,
				pid: $(td[2]).find('a').text(),
				rid: rid,
				oj: 'cfgym',
				language: 'cpp17',
				status: result.is_accepted ? 'Accepted' : 'Wrong Answer',
				total_time: 0,
				max_memory: 0,
				score: result.score
			}
		},
		atc: (rid) => {
			let q = $(html), oj = 'atc';
			let table = $($(q.find('table')[0]).find('tr'));
			let href = $(table[1]).find('td a').attr('href').split('/');
			let pn = href[href.length - 1];
			let pi = pn[pn.length - 1].toUpperCase();
			pn = pn.substr(0, pn.length - 2);
			let cn = href[href.length - 3];
			if(pn.search('-') == 0){
				pn = cn + '/' + pn + '_';
				oj = 'at';
			}
			let st = $(table[6]).find('td span').text();
			return {
				code: q.find('.source-code-for-copy').text(),
				pid: (pn + pi).toUpperCase(),
				rid: rid,
				oj: oj,
				language: 'cpp17',
				status: st == 'AC' ? 'Accepted' : 'Wrong Answer',
				total_time: 0,	
				max_memory: 0,
				score: st == 'AC' ? 100 : 0
			};
		},
		vj: (rid) => {
			var oj = 'vj';
			let deal_ext = {
				洛谷: (pid) => {
					oj = 'luogu';
					rid = q.find('td.remote-run-id > a').text();
					return pid.substr(3);
				},
				AtCoder: (pid) => {
					oj = 'atc';
					rid = q.find('td.remote-run-id > a').text();
					return replaceLast(pid.substr(8), '_', '');
				},
				CodeForces: (pid) => {
					oj = 'cf';
					rid = q.find('td.remote-run-id > a').text();
					return pid.substr(11);
				},
				UniversalOJ: (pid) => {
					oj = 'uoj';
					rid = q.find('td.remote-run-id > a').text();
					return pid.substr(12);
				},
				QOJ: (pid) => {
					oj = 'qoj';
					rid = q.find('td.remote-run-id > a').text();
					return pid.substr(4);
				},
				Gym: (pid) => {
					oj = 'gym';
					rid = q.find('td.remote-run-id > a').text();
					return pid.substr(4);
				},
				CodeChef: (pid) => {
					oj = 'cc';
					rid = q.find('td.remote-run-id > a').text();
					return pid.substr(9);
				},
				CSAcademy: (pid) => {
					oj = 'csa';
					rid = q.find('td.remote-run-id > a').text();
					return pid.substr(10);
				}

			}
			let q = $(html);
			let td = q.find('tbody').find('td');
			let st = $(td[0]).text();
			if(st == 'Happy New Year!') 
				st = 'Accepted';
			if(st != 'Accepted')
				st = 'Wrong Answer';

			let pid = $(q.find('h5 a')[2]).attr('href').split('/');
			pid = pid[pid.length - 1];

			if(request.vj_origin) for(let oj_pattern in deal_ext) {
				console.log(oj_pattern);
				if(pid.search(oj_pattern) != -1) {
					pid = deal_ext[oj_pattern](pid);
					break;
				}
			}

			let ret = {
				code: q.find('code').text(),
				pid: pid,
				rid: rid,
				oj: oj,
				language: 'cpp17',
				status: st,
				total_time: 0,
				max_memory: 0,
				score: st == 'Accepted' ? 100 : 0
			}
			return ret;
		},
		cc: (rid) => {
			let q = $(html);
			let st = q.find("[class^='_status_container'] span").text();
			if(st == 'Correct Answer')
				st = 'Accepted';
			let ret = {
				code: ace_code(q),
				pid: $(q.find("[class^='_submissionDetailContainer'] [class^='_link']")[0]).text(),
				rid: rid,
				oj: 'cc',
				language: 'cpp17',
				status: st,
				total_time: 0,
				max_memory: 0,
				score: st == 'Accepted' ? 100 : 0
			}
			return ret;
		},
		csa: (rid) => {
			let q = $(html);
			let txt = q.find("[class^=' ProgressBar-container'] span").text();
			if(!txt){
				alert('请提交评测，若已经提交请切换到Submission选项卡。');
				return false;
			}
			let m = /Score: (.*)\/100 \(.+\)/.exec(txt);
			if(!m){
				alert('请提交评测，若已经提交请切换到Submission选项卡。');
				return false;
			}
			let score = Number(m[1]), code = ace_code(q);
			var hash = 0;
			for(let c of code) {
				hash = ((hash << 5) - hash) + c;
				hash |= 0;
			}
			let ret = {
				code: code,
				pid: rid,
				rid: hash,
				oj: 'csa',
				language: 'cpp17',
				status: score >= 100-1e-6 ? 'Accepted' : 'Wrong Answer',
				total_time: 0,
				max_memory: 0,
				score: score
			}
			return ret;
		},
		xyd: (pid) => {
			let q = $(html);
			let pd = q.find("#rc-tabs-0-panel-submissions > div > div.ac-ant-space.ac-ant-space-vertical > div > div > div > div > span:nth-child(1)");
			if(pd.length == 0) {
				alert('确保你的位置在提交记录界面.');
				return false;
			}
			let td = q.find("tr.ac-ant-table-row-selected td");
			if(td.length == 0){
				alert('请点击已提交的代码的详情眼睛符号。');
				return false;
			}
			let tmp = pd.text().substr(5);
			if(parseInt(tmp).toString() == tmp) {
				pid = tmp;
			}
			console.log(pid);
			let code = '';
			for(let line of q.find('.CodeMirror-code .CodeMirror-line'))
				code += $(line).text() + '\n';
			let status = $(td[2]).text();
			if(status == 'Acceptable Answer') status = 'Partially Correct';
			let ret = {
				code: code,
				pid: pid,
				rid: $(td[0]).text(),
				oj: 'xyd',
				language: 'cpp17',
				status: status,
				total_time: 0,
				max_memory: 0,
				score: parseInt($(td[3]).text())
			}
			return ret;
		},
		oifha: (rid) => {
			let q = $(html);
			let code = q.find('code').text();
			if(!code){
				alert('找不到代码框，应当提交自己的提交记录。');
				return false;
			}
			let ref = $(q.find('.large.horizontal dd')[1]).find('a').attr('href').split('/');
			if(ref.length < 5){
				alert('页面题目链接格式不正确，请联系开发者。');
				return false;
			}
			let pid = ref[2] + '/' + ref[4];
			pid = pid.split('?')[0];
			let ret = {
				code: code,
				pid: pid,
				rid: rid,
				oj: 'oifha',
				language: 'cpp17',
				status: q.find('.section__title .record-status--text').text().trim(),
				total_time: 0,
				max_memory: 0,
				score: $(q.find('.section__title span')[1]).text().trim()
			}
			return ret;
		},
		'7fa4': rid => {
			let q = $(html);
			let code = q.find('pre code.language-cpp');
			if(code.length != 1){
				alert('请评测完后提交。');
				return false;
			}
			let td = $(q.find('tbody tr td'));
			let pid = $(td[1]).find('a').attr('href').split('/');
			return {
				code: $(code).text(),
				pid: pid[pid.length-1],
				rid: rid,
				oj: '7fa4',
				language: 'cpp17',
				status: $(td[2]).text().trim(),
				total_time: $(td[4]).text().split(' ')[0],
				max_memory: $(td[5]).text(),
				score: $(td[3]).text()
			}
		}
	}
	let state = null, is_oj = false;
	for(let name in oj_urls){
		if(!oj_host[name].exec(sender.origin))
			continue;
		is_oj = true;
		let m = oj_urls[name].exec(sender.url);
		if(m){
			state = oj_deal[name](m[1]);
			break;
		}
	}
	if(state === null){
		if(is_oj)
			alert('请到该OJ的详细提交记录页面发送提交记录。');
		else
			alert('暂时不支持这个站点的提交记录同步。');
		return;
	}
	if(!state)
		return;
	state.in_contest = in_contest;
	console.log(state);
	chrome.storage.sync.get("cookies", ({ cookies }) => {
		if(!cookies || !cookies.login || !cookies['connect.sid']){
			alert('7FA4登录信息不完整，请到7FA4页面保存登录信息。');
			return;
		}
		let headers = new Headers({
			"Cookie": `login=${cookies.login}; connect.sid=${cookies['connect.sid']}`,
			"Content-Type": "application/json"
		});
		let current_host = cookies.chost;
		console.log(`http://${current_host}/foreign_oj`);
		fetch(
			`http://${current_host}/foreign_oj`, {
				headers: headers,
				credentials: "include",
				method: 'POST',
				body: JSON.stringify(state)
			}
		).then(
			res => res.json()
		).then(
			json => {
				if(json === undefined) {
					alert('你可能正确了，请到 7FA4 的提交记录中获取真实信息。')
				}
				else {
					console.log(json);
					alert(json.success ? json.info : json.err);
				}
			}
		)
	});
	sendResponse("完成响应。");
})

document.addEventListener('DOMContentLoaded', () => {
	freshLoginStatus();
});
