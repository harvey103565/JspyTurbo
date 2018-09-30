// ==UserScript==
// @name         jira
// @namespace    http://ZTE.wiki.user.js/
// @version      0.1
// @description  填写Jira任务资料.
// @author       Wang haowen
// @include      https://jira.zte.com.cn/browse/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @require      https://cdnjs.cloudflare.com/ajax/libs/rxjs/5.3.0/Rx.min.js
// @require      http://localhost:8086/static/scripts/constants.js
// ==/UserScript==


(function() {
    'use strict';

    //-- Don't run on frames or iframes
    if (window.top != window.self)
        return;

    console.log('### starting Jira user js.');

    class Page {

        Href() {
            return window.location.href;
        }

        Name() {
            return $('h1#title-text>a').text();
        }

        wiki_href() {
            return $('#description-val > div > p > a')[0].href;
        }

        async jump(path) {
            window.location.pathname = path;
        }

        async navigate(href) {
            window.location.href = href;
        }

        async edit() {
            $('#edit-issue').click();
            await idle(1.5);

            return Promise.resolve(true);
        }

        async input(which, what) {
			which.focus()
			which.trigger('keydown');
			which.val(what);
            which.trigger('keyup');
            which.trigger('input');
            which.trigger('change');
        }

        async to_finish() {
            $('#action_id_201').click();
            await idle(1);

            return Promise.resolve(true);
        }

        async jira(data) {
            var assignee = data[_ASSIGNEE_];
            this.input($('#assignee-field'), assignee);
            await idle(3.2);
            $('div#assignee-suggestions > div > ul > li:first').click()

            var text = '';
            var multi_assignees = data[_MULTI_ASSIGNEE_];
            var input_box = $('#customfield_10511');
            for (var one of multi_assignees.split(',')) {
                this.input(input_box, text + one);
                await idle(3.2);

                $('#edit-issue-dialog > div.jira-dialog-content > div.qf-container > div > form > div.form-body > div > div:nth-child(5) > div > div > ul > li:first').click()
                await idle(0.8)

                text = input_box.val();
            }

            var reportee = data[_REPORTEE_];
            if (reportee !== undefined && reportee !== null && reportee !== '') {
                this.input($('#reporter-field'), reportee);
                await idle(3.2);
                $('div#reporter-suggestions > div > ul > li:first').click();
            }

            var version = data[_REVISION_];
            this.input($('#customfield_14503'), version);

            var serial = data[_REQUIREMENT_SERIAL_];
            this.input($('#customfield_14600'), serial);

            await idle(0.8);

            return Promise.resolve(true);
        }

        async save() {
            $('#edit-issue-submit').click()
            await idle(1.5);''

            return Promise.resolve(true);
        }
    }

    function idle(s) {
        return new Promise(resolve => setTimeout(resolve, s * _SECOND_));
    }

    function dom(which, what, who, how) {
        var options = {
            'childList': true,
            'attributes': true,
            'subtree': false
        };

        var element = document.querySelector(which);

        var p = Rx.Observable
            .from(new Promise(function(resolve, reject) {
                var observer = new MutationObserver(function (mutations, observer) {
                    resolve(mutations);
                });

                observer.observe(element, options);
            }))
            .flatMap(mutations => Rx.Observable.from(mutations))
            .filter(mutation => what.is(mutation.target))
            .take(1)
            .toPromise();

        who.trigger(how);

        return p;
    }

    function http(m, c, d) {
        return new Promise(function(resolve, reject) {
            GM_xmlhttpRequest({
                method: m,
                url: 'http://127.0.0.1:8086/' + c,
                data: d === undefined ? '{}' : JSON.stringify(d),
                headers: {'Content-Type': 'application/json', 'Accept': 'application/json', 'charset': 'utf-8'},
                overrideMimeType: "application/json",
                onload: function(r) {
                    console.log(`### http "${m}" "${c}" response: <` + r.status + '> '  + r.responseText)
                    if (r.status === 200) {
                        resolve(r.responseText);
                    } else {
                        reject(Error(r.responseText));
                    }
                }
            });
        });
    }
    

    function HttpAction(module, requirement) {
        var data = {};
        data[_PARAM_MODULE_] = module;
        data[_PARAM_REQUIREMENT_] = requirement;

        return http('POST', 'action', data);
    }

    function QueryJira(url) {
        var data = {};
        data[_PARAM_URL_] = url;

        return http('POST', 'query_jira', data);
    }

    function JiraDone(url) {
        var data = {};
        data[_PARAM_URL_] = url;

        return http('POST', 'jira_done', data);
    }

    function HttpTodo(module) {
        var data = {};
        data[_PARAM_MODULE_] = module;

        return http('POST', 'todo', data);
    }

    function dotodos(page, module, url) {
        return HttpTodo(module)
            .then(t => JSON.parse(t))
            .then(j => j[_URL_])
            .then(function (u) {
                if (u !== undefined) {
                    page.navigate(u);
                } else {
                    page.navigate(url);
                }

                return Promise.resolve(true);
            });
    }

    async function JiraAction(page, data) {
        await page.edit();
        await page.jira(data);
        await page.save();
        await page.to_finish();

        return Promise.resolve(true);
    }

    async function StartJira(page, info, url) {
        var module = info[_PARAM_MODULE_];
        var requirement = info[_PARAM_REQUIREMENT_];
        var wiki_url = page.wiki_href();

        await Rx.Observable
            .from(HttpAction(module, requirement))
            .map(t => JSON.parse(t))
            .toPromise()
            .then(function(act_data) {
                return JiraAction(page, act_data);
            })
            .then(() => JiraDone(url))
            .then(() => dotodos(page, module, wiki_url))
            .catch(() => dotodos(page, module, wiki_url));
        
        return Promise.resolve(true);
    }

    async function doJobChain() {
        var page = new Page();
        var url = page.Href();

        await Rx.Observable
            .from(QueryJira(url))
            .map(t => JSON.parse(t))
            .toPromise()
            .then(info => StartJira(page, info, url));

        return Promise.resolve(true);
    }

    function inject() {
        var button = document.createElement('input');
        button.setAttribute('type', 'button');
        button.setAttribute('id', 'wikits_tool');
        button.setAttribute('class', 'aui-button aui-button-primary');
        button.setAttribute('title', '对当前页面中止进行中的脚本任务');

        $('#header > nav > div > div.aui-header-primary > ul').append(button);

        return button;
    }

    function activation(pref) {
        console.log('### activation()')

        var button = inject()

        var delay = parseInt(pref[_WINDOW_])

        var t = Rx.Observable
            .timer(_SECOND_, _SECOND_)
            .take(delay + 1)
            .map(i => delay - i)
            .subscribe(i => button.setAttribute('value', _PAUSE_ + i),
                err => console.error('' + err),
                function() {
                    button.setAttribute('value', _PAUSE_); 
                    button.disabled = true;
                    doJobChain();
                });

        var c = Rx.Observable
            .fromEvent(button, 'click')
            .subscribe(function() {
                t.unsubscribe(); 
                button.setAttribute('value', _RESUME_);
                button.disabled = true;
            });
    }

    $(document).ready(function() {
        console.log('### document ready().')

        Rx.Observable
            .from(http('POST', 'preference'))
            .map(t => JSON.parse(t))
            .toPromise()
            .then(pref => activation(pref))
            .catch(e => alert(e.message));
    });
})();
