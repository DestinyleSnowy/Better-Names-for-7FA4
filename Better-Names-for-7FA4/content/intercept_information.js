function callback() {
    const body = document.documentElement;
    if (!body) return false;
    body.innerHTML = body.innerHTML.replace(
        /(<h4 class="ui top attached block header">个性签名<\/h4>)\s*(<div class="ui bottom attached segment">)\s*/g,
        "$1$2"
    )
    const SearchFirst = body.innerHTML.search(`<h4 class="ui top attached block header">个性签名</h4><div class="ui bottom attached segment">`);
    console.error("123");
    const SearchEnd = body.innerHTML.search(`</div>
                                    </div>
                                  <div class="row">
                                      <div class="column">
                                          <h4 class="ui top attached block header">学习进度</h4>`);
    console.log(SearchFirst, "to", SearchEnd);
    if (SearchFirst === -1 || SearchEnd === -1) return false;
    const information = body.innerHTML.substr(SearchFirst, SearchEnd-SearchFirst);
    console.log("找到个签：", information);
    const div = document.createElement("div");
    WriteCleanHTML(div, information);
    const cleanHTML = div.innerHTML;
    console.log("cleanHTML", cleanHTML);
    div.remove();
    body.innerHTML = body.innerHTML.replace(information, cleanHTML);
    return true;
}
function intercept() {
    const observer = new MutationObserver(mutations => {
        if (callback()) observer.disconnect();
    });
    observer.observe(document.documentElement, {childList: true, subtree: true});
}
// intercept();