// ==UserScript==
// @name         wiki
// @namespace    http://ZTE.wiki.user.js/
// @version      0.1
// @description  重命名Wiki页面标题，修改需求页面内的表格内容以及为模块和需求页面打标签.
// @author       Wang haowen
// @include      https://wiki.zte.com.cn/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @require      https://cdnjs.cloudflare.com/ajax/libs/rxjs/5.3.0/Rx.min.js
// @require      http://localhost:8086/static/scripts/constants.js
// ==/UserScript==

(function() {
    'use strict';

    //-- Don't run on frames or iframes
    if (window.top !== window.self)
        return;

    console.log('### starting Wiki min js.');

    class WikiPage {
        constructor(project) {
            this.root = this.Branch(project);
            this.current = this.root;

            this.module = ''
            this.requirement = ''
        }

        Href() {
            return window.location.href;
        }

        Name() {
            return $('h1#title-text > a').text();
        }

        StoryHref(story) {
            return story.find('a.jira-issue-key').attr('href');
        }

        Root() {
            this.current = this.root;
        }

        Branch(key) {
            var element = $(`li > div > span > a:contains("${key}")`).closest('li').get(0);
            this.current = $(element);
            return this.current;
        }

        HighLightten() {
            this.current = $("span.plugin_pagetree_current").closest('li');
            return this.current;
        }

        BranchName() {
            return this.current.find('div:eq(1) > span > a').text();
        }

        Project() {
            return this.root.find('div:eq(1) > span > a').text();
        }

        Leaves() {
            var array = [];
            
            var branches = this.current.find('div:eq(2) > ul > li');
            branches.find('div:eq(1) > span > a').each((i, e) => array[i] = [e.innerText, e.href]);

            return array;
        }

        Parent() {
            if (this.IsRoot()) {
                throw new Error('Current is the root.');
            }

            var start = this.current.parent();

            this.current = start.closest('li');
        }

        IsRoot() {
            return this.current.is(this.root);
        }

       Type() {
            this.HighLightten()
            if (this.IsRoot()) {
                return _P_;
            }

            this.module = this.BranchName()
            this.requirement = ''

            this.Parent()
            if (this.IsRoot()) {
                return _M_;
            }

            this.requirement = this.module
            this.module = this.BranchName()
            this.Parent()
            if (this.IsRoot()) {
                return _R_;
            }

            return _O_;
        }

        Info() {
            var info = {}
            info[_PARAM_MODULE_] = this.module;
            info[_PARAM_REQUIREMENT_] = this.requirement
            return info;
        }

        TableFor(text, seqn, conext) {
            var content = ''
            if (text !== undefined && text !== null && text !== '') {
                content = `:contains("${text}")`;
            }

            var order = ''
            if (seqn !== undefined && seqn !== null && seqn !== '') {
                order = `:nth-child(${seqn})`;
            }

            var selector = `table${order} > tbody > tr${content}`;
            var table = $(selector, conext).closest('tbody');
            var deeper = undefined;
            while(table.length > 1) {
                deeper = table;
                table = deeper.find(selector, conext).closest('tbody');
            }

            return table;
        }

        TableFrame(table) {
            var rows = table.find('tr');
            var headers = new Array();
            var frame = {}

            rows.each(function (i, e) {
                headers[i] = $(e).find('*:first').text()
            });

            frame[_PARAM_HEADER_] = headers;
            return frame;
        }

        jump(path) {
            window.location.pathname = path;
        }

        navigate(href) {
            window.location.href = href;
        }

        macro(which, what) {
            var h = `<div class="content-wrapper"><p><img class="editor-inline-macro" height="18" width="88" src="/plugins/servlet/status-macro/placeholder?title=aaa&amp;colour=Green" data-macro-name="status" data-macro-parameters="colour=Green|title=${what}" data-macro-schema-version="1"></p></div>`
            which[0].innerHTML = h;
        }

        async edit() {
            await dom_trigger('#content', 
                function (mutation) {
                    return true;
                },
                {'childList': true, 'subtree': false},
                $('#editPageLink'),
                element => element.click());

            return idle(0.6);
        }

        async rename(text) {
            $('#content-title').val(text);
            await idle(0.8);

            var sub_title = $('#tinymce > p:nth-child(2) > span:contains("页面名称")', $("#wysiwygTextarea_ifr").contents());
            if (sub_title !== undefined) {
                sub_title.empty();
            }

            return idle(0.8);
        }

        async fill(data) {
            var contents = $("#wysiwygTextarea_ifr").contents()
            var table1 = this.TableFor(_SERIAL_, undefined, contents);
            var table3 = this.TableFor(_EDITOR_, undefined, contents)

            var count = table1.children('tr').length;
            var contents = data[_PARAM_TABLE_];
            var headers = data[_PARAM_HEADER_];
            var jira = data[_JIRA_STORY_];
            for (var i = 0; i < count; i ++) {
                var row = table1.children(`tr:nth-child(${i + 1})`);
                var header = row.children('*:first').text()
                var content = contents[header];
                var cell = row.children('td:nth-child(2)')

                if (content !== null) {
                    if (header === headers[_FEATURE_STATE_] || header === headers[_DELIVERED_STATE_]) {
                        this.macro(cell, content)
                    } else {
                        cell.text(content);
                    }

                    if (header === jira) {
                        this.replace_story(cell, content, data[_CODE_NAME_]);
                    }
                }
            }

            var date = new Date().toLocaleDateString();
            var owner = contents[headers[_FEATURE_OWNER_]]
            for (var i = 1; true; i ++) {
                var row = table3.find(`tr:nth-child(${i})`);
                if (row.length === 0 || row[0] === undefined) {
                    break;
                }
                
                var p = row.children('td:nth-child(1)').text();
                var d = row.children('td:nth-child(2)').text();
                if ((p !== '' && d !== '') && (p !== undefined && d !== undefined) && (p !== null && d !== null)) {
                    row.children('td:nth-child(1)').empty();
                    row.children('td:nth-child(2)').empty();
                }
                row.children('td:nth-child(1)').text(owner);
                row.children('td:nth-child(2)').text(date);
            }

            return idle(1.6);
        }

        async tag(tagserial, deletes, modification) {
            // 等待对话框出现
            await dom_trigger('#com-atlassian-confluence', 
                function (mutation) {
                    for (var i = 0; i < mutation.addedNodes.length; i++) {
                        if ($(mutation.addedNodes[i]).is($('#edit-labels-dialog'))) {
                            return true;
                        }
                    }
                    return false;
                },
                {'childList': true, 'subtree': false}, 
                $('#labels-section > div > div > ul > li.labels-edit-container > a > span'), 
                element => element.click());
            await idle(1.6);

            // 标签
            $('#dialog-label-list > ul > li[data-label-id]')
                .map(function(i) {
                    var close = $(this).find('span > span[title="Delete Label"]');
                    if (modification === true) {
                        var label = $(this).find('a[rel="tag"]').text();
                        if (deletes.includes(label)) {
                            close.click();
                        }
                    } else {
                        close.click();
                    }
                });
            await idle(1.6);

            $('#labels-string').attr('value', tagserial);
            $('#add-labels-editor-button').click();
            await idle(1.6);

            // 关闭
            $('#edit-labels-dialog > div > div.dialog-button-panel > a').click();

            return idle(0.8);
        }

        async copy(data, former_name) {
            await dom_trigger('#com-atlassian-confluence', 
                function (mutation) {
                    for (var i = 0; i < mutation.addedNodes.length; i++) {
                        if ($(mutation.addedNodes[i]).is($('#action-menu'))) {
                            return true;
                        }
                    }
                    return false;
                },
                {'childList': true, 'subtree': false}, 
                $('#action-menu-link'), 
                element => element.click());
            await idle(0.8);

            $('#action-copy-page-link').click();
            await idle(0.8);

            await dom_trigger('#destination-options > div:nth-child(1) > div', 
                function (mutation) {
                    for (var i = 0; i < mutation.addedNodes.length; i++) {
                        if ($(mutation.addedNodes[i]).is($('#destination-options > div:nth-child(1) > div > div'))) {
                            return true;
                        }
                    }
                    return false;
                },
                {'childList': true, 'subtree': false},
                $('#copy-destination-space'), 
                element => this.input(element, data[_TO_SPACE_]));
            await idle(0.8);
            $('#destination-options > div:nth-child(1) > div > div > ol > li:first > a').click();
            await idle(1.6);
            
            await dom_trigger('#destination-options > div:nth-child(2) > div', 
                function (mutation) {
                    for (var i = 0; i < mutation.addedNodes.length; i++) {
                        if ($(mutation.addedNodes[i]).is($('#destination-options > div:nth-child(2) > div > div'))) {
                            return true;
                        }
                    }
                    return false;
                },
                {'childList': true},
                $('#copy-destination-page'), 
                element => this.input(element, data[_PROJECT_NAME_]));
            await idle(0.8);
            $('#destination-options > div:nth-child(2) > div > div > ol > li:first > a').click();
            await idle(0.8);
            
            $('#include-children').click();
            await idle(0.8);

            $('#copy-dialog-next').click();
            await idle(0.8);

            var outline = data[_PAGE_OUTLINE_];
            var name = data[_MODULE_NAME_];
            var new_prefix = data[_CODE_NAME_] + '-';
            var new_pos = outline.indexOf(name);
            if (new_pos !== -1) {
                new_prefix = outline.substring(0, new_pos);
            }

            var former_pos = former_name.indexOf(name);
            if (former_pos !== -1) {
                var former_prefix = former_name.substring(0, former_pos);
                this.input($('#search-string'), former_prefix);
                this.input($('#replace-string'), new_prefix);
            } else {
                this.input($('#title-prefix'), new_prefix);
            }
            await idle(0.8);

            $('#copy-page-hierarchy-submit').click();
            await idle(1.2);

            do {
                var jump_to = $('#view-copied-pages');

                if (jump_to.length > 0) {
                    this.navigate(jump_to[0].href);
                    await idle(1.2);
                }
                await idle(1.2);
            } while(true);
        }

        async jira(data) {
            var table = $("#tinymce > table.wysiwyg-macro > tbody > tr > td > table", $("#wysiwygTextarea_ifr").contents());
            if (table.find("tbody > tr:nth-child(7) > td:nth-child(1)").text() === '特性限制') {
                var cell = table1.find("tbody > tr:nth-child(10) > td:nth-child(2)");
            } else {
                var jira = table.find("tbody > tr:nth-child(9) > td:nth-child(2)");
            }

            var input = document.createElement('input');
            input.setAttribute('type', 'text');
            input.setAttribute('width', '100');
            input.setAttribute('height', '60');
            jira.append(input);
            input.focus();

            $('#rte-button-insert').click();
            await idle(0.8);

            $('#jiralink').click()
            await idle(1.6);

            $('#jira-connector > div > ul > li:nth-child(2) > button').click();
            await idle(0.8)
            
            var project = data[_CODE_NAME_];

            // 点击并等待下拉框弹出
            await dom_trigger('#com-atlassian-confluence', 
                function (mutation) {
                    for (var i = 0; i < mutation.addedNodes.length; i++) {
                        if ($(mutation.addedNodes[i]).is(
                            $('#com-atlassian-confluence > div.select2-drop.aui-select2-drop.aui-dropdown2.aui-style-default.aui-layer.select2-with-searchbox.select2-drop-active'))) {
                            return true;
                        }
                    }
                    return false;
                },
                {'childList': true, 'subtree': false},
                $('#s2id_autogen2 > a > span > span'), 
                element => element.mousedown());
            await idle(0.8);
            
            // 输入项目名称并等待匹配
            var project_input = $('#com-atlassian-confluence > div.select2-drop.aui-select2-drop.aui-dropdown2.aui-style-default.aui-layer.select2-with-searchbox.select2-drop-active > div > input')
            await dom_trigger('#com-atlassian-confluence > div.select2-drop.aui-select2-drop.aui-dropdown2.aui-style-default.aui-layer.select2-with-searchbox.select2-drop-active > ul', 
                function (mutation) {
                    return true;
                },
                {'childList': true, 'subtree': false},
                project_input, 
                project_input => this.input(project_input, project));
            await idle(0.8);

            var results = $('#com-atlassian-confluence > div.select2-drop.aui-select2-drop.aui-dropdown2.aui-style-default.aui-layer.select2-with-searchbox.select2-drop-active > ul > li');
            if (results.text().indexOf('No matches found') === -1) {
                var selector = $('#com-atlassian-confluence > div.select2-drop.aui-select2-drop.aui-dropdown2.aui-style-default.aui-layer.select2-with-searchbox.select2-drop-active > ul > li:nth-child(1)');
                selector.click();
                selector.mouseup();
                await(0.8);
            } else {
                alert('输入的项目名称没有匹配Jira项目。');
                return Promise.reject(new Error('输入的项目名称没有匹配Jira项目。'));
            }
            await idle(0.5);

            // 点击Jira类型框并等待弹出
            await dom_trigger('#com-atlassian-confluence', 
                function (mutation) {
                    return true;
                },
                {'childList': true, 'subtree': false},
                $('#s2id_autogen3 > a > span > span'), 
                element => element.mousedown());
            await idle(0.8);

            var selector = 
            $('#com-atlassian-confluence > div.select2-drop.aui-select2-drop.aui-dropdown2.aui-style-default.aui-layer.select2-with-searchbox.select2-drop-active > ul > li:nth-child(2)');
            selector.click();
            selector.mouseup();
            await(0.8);

            var summary = data[_REQUIREMENT_NAME_];
            var summary_input = $('#jira-create-form > fieldset.create-issue-default-fields > div:nth-child(4) > input');
            summary_input.val(summary);

            var href = $('#breadcrumbs > li:last > span > a')[0].href;
            var description_input = $('#jira-create-form > fieldset.create-issue-default-fields > div:nth-child(5) > textarea');
            description_input.val(href);
            await idle(0.8);

            $('#jira-connector > div > div.dialog-button-panel > button').click()
            await idle(0.8);

            input.remove();

            return idle(0.8);
        }

        async save() {
            $('#notifyWatchers').prop('checked', false);
            await idle(1);

            $('#rte-button-publish').click()

            // 等待一小时并报错
            await idle(60*60);
            return Promise.reject(Error('保存编辑超时，重新点击需求链接重试。'));
        }

        async close() {
            $('#rte-button-cancel').click();

            // 等待一小时并报错
            await idle(60*60);
            return Promise.reject(Error('保存编辑超时，重新点击需求链接重试。'));
        }

        replace_story(which, what, name) {
            var stories = which.find('img');
            for (var i = 0; i < stories.length; i ++) {
                var story = $(stories[i]);
                 if (story.attr('data-macro-parameters').indexOf(name) === -1) {
                        story.remove();
                }
            }
            var html = which[0].innerHTML.trim();
            var text = which[0].innerText.trim();
            which.empty();
            which[0].innerHTML = html.replace(text, what);
        }

        input(which, what) {
			which.focus()
			which.trigger('keydown');
			which.val(what);
            which.trigger('keyup');
            which.trigger('input');
            which.trigger('change');
        }

        story(name, title) {
            var jira = $('#main-content > div.plugin-tabmeta-details.conf-macro.output-block > div > table > tbody > tr:nth-child(9) > td:nth-child(2) > span.jira-issue');
            var story = undefined;

            if (jira.length === 0) {
                return undefined;
            }

            jira.each(function(i, e) {
                story = $(e);
                
                var project = story.attr('data-jira-key');
                var text = story.text();
                var outline = story.find('span.summary').text();

                if (project.indexOf(name) === -1 || outline !== title || text.indexOf(_REQUIREMENT_EDITTING_) === -1) {
                        story = undefined;
                }
            });

            return story;
        }
    }

    var _P_ = '项目';
    var _M_ = '模块';
    var _R_ = '需求';
    var _O_ = '其它';

    var _UPDATE_ = '更新';
    var _COPY_ = '复制';
    var _RENAME_ = '命名';
    var _TAG_ = '标签'
    var _TO_DO_ = '待处理';
    var _EDIT_ = '编辑';
    var _JIRA_ = 'Jira';

    var _TASKS_ = 'tasks';
    var _PREF_ = 'preference';
    var _PROJECT_ = 'project';

    var ActionVectors = {}
    ActionVectors[_P_] = ProjectAction;
    ActionVectors[_M_] = ModuleAction;
    ActionVectors[_R_] = RequirementAction;

    function idle(s) {
        return new Promise(resolve => setTimeout(resolve, s * _SECOND_));
    }

    function dom_trigger(which, what, options, who, how) {
        var element = document.querySelector(which);

        var observer = undefined;
        var p = Rx.Observable
            .from(new Promise(function(resolve, reject) {
                observer = new MutationObserver(function (mutations, observer) {
                    resolve(mutations);
                });

                observer.observe(element, options);

                how(who);
            }))
            .flatMap(mutations => Rx.Observable.from(mutations))
            .filter(mutation => what(mutation))
            .take(1)
            .toPromise()
            .then(function(ob) {
                    if (observer !== undefined) {
                        observer.disconnect();
                    }
                return Promise.resolve(true);
            })
            .catch(e => alert(e.message));

        return p;
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

    function HttpAction(info, table) {
        return http('POST', 'action', Object.assign({}, info, table));
    }

    function HttpDone(info, serial) {
        var data = info;
        data[_PARAM_SERIAL_] = serial;

        return http('POST', 'done', data);
    }

    function HttpJira(info, url) {
        var data = info;
        data[_PARAM_URL_] = url;
        return http('POST', 'jira', data);
    }

    function HttpTodo(info) {
        return http('POST', 'todo', info);
    }

    function update_directory(page) {
        page.Root();
        var modules = page.Leaves();

        var data = {};
        data[_PARAM_MODULES_] = modules;

        return http('POST', 'directory', data);
    }

    function update_manifest(page, info) {
        var data = info;
        var which_module = info[_PARAM_MODULE_];
        page.Branch(which_module);

        var requirements = page.Leaves();
        data[_PARAM_REQUIREMENTS_] = requirements;

        return Rx.Observable
            .from(http('POST', 'manifest', data))
            .map(t => JSON.parse(t))
            .toPromise();
    }

    function CopyModule(page, data) {
        return page.copy(data, page.Name());
    }

    function tag_page(page, data) {
        var tags = data[_TAG_SERIAL_].trim();

        var delstrs = new RegExp(_PARAM_DELETE_).exec(tags);
        var deltags = null;
        var del = (delstrs !== null);
        if (del === true) {
            deltags = delstrs[1].trim().split(/\s+/);
            tags = tags.replace(delstrs[0], '').trim();
        }

        var append = (tags.indexOf(_PARAM_APPEND_) !== -1);
        if (append === true) {
            tags = tags.trim().replace(_PARAM_APPEND_, '').trim();
        }

        return page.tag(tags, deltags, append || del);
    }
   
    function rename_page(page, data_sbj) {
        return data_sbj
            .toPromise()
            .then(function (data) {
                var text = data[_PAGE_OUTLINE_];
                return page.rename(text);
            })
    }
   
    function edit_reqirement(page, data_sbj) {
        return data_sbj
            .toPromise()
            .then(function (data) {
                return page.fill(data);
            })
    }
   
    function create_jira(page, data_sbj) {
        return data_sbj
            .toPromise()
            .then(function (data) {
                return page.jira(data);
            })
    }

    function enter_edition(page) {
        return page.edit();
    }

    function save_edition(page) {
        return page.save();
    }

    function is_edit_reqrm_task(t) {
        return (t.includes(_EDIT_) || t.includes(_RENAME_) || t.includes(_JIRA_));
    }

    function do_todos(page, info) {
        console.log('### dotodos()');

        return HttpTodo(info)
            .then(t => JSON.parse(t))
            .then(j => j[_URL_])
            .then(function (u) {
                if (u !== undefined && u !== '') {
                    page.navigate(u);
                } else {
                    alert('任务执行完毕。');
                }
                return Promise.resolve(true);
            });
    }

    function go_edit_jira(data_sbj, page, info) {
        console.log('### go_edit_jira()');

        return data_sbj
            .toPromise()
            .then(async function (data) {
                var project = data[_CODE_NAME_];
                var outline = data[_REQUIREMENT_NAME_];
                var story = page.story(project, outline);

                if (story !== undefined) {
                    var url = page.StoryHref(story);
                    await HttpJira(info, url);
        
                    page.navigate(url);

                    // 等待一小时并报错
                    await idle(60*60);
                    return Promise.reject(Error('保存编辑超时，重新点击需求链接重试。'));
                } else {
                    return idle(0.8);
                }
            });
    }

    function check_edit_jira(task_sbj, data_sbj, page, info) {
        console.log('### check_edit_jira()');

        return task_sbj
            .filter(t => t.includes(_JIRA_))
            .toPromise()
            .then(function (t) {
                if (t !== undefined) {
                    return go_edit_jira(data_sbj, page, info);
                }
            });
    }

    async function ProjectAction(task_sbj, data_sbj, page, info) {
        console.log('### ProjectAction()');

        await task_sbj
            .filter(t => t.includes(_UPDATE_))
            .toPromise()
            .then(function(t) {
                if (t !== undefined) {
                    return update_directory(page);
                }
            })
            .then(function () {
                return do_todos(page, info);
            })
            .catch(function (e) {
                return do_todos(page, info);
            });
    }

    async function DoModuleEditionAction(data_sbj, page, info) {
        console.log('### DoModuleEditionAction()');

        await enter_edition(page);

        // Rename with data
        await rename_page(page, data_sbj)
            .then(function () {
                return HttpDone(info, '');
            });

        return save_edition(page);
    }

    async function DoModuleTagAction(data_sbj, page) {
        console.log('### DoModuleActionTag()');

        // Tag with data
        return data_sbj
            .toPromise()
            .then(function (data) {
                if (data !== undefined) {
                    return tag_page(page, data);
                }
            });
    }

    async function DoModuleActionDirectly(task_sbj, data_sbj, page, info) {
        console.log('### DoModuleDirectly()');

        // tag
        await task_sbj
            .filter(t => t.includes(_TAG_))
            .toPromise()
            .then(function (t) {
                if (t !== undefined) {
                    return DoModuleTagAction(data_sbj, page);
                }
            });

        // Edit Page
        return task_sbj
            .filter(t => t.includes(_RENAME_))
            .toPromise()
            .then(function (t) {
                if (t !== undefined) {
                    return DoModuleEditionAction(data_sbj, page, info);
                }
            });
    }

    async function ModuleActionDirectly(task_sbj, data_sbj, page, info, on_doing) {
        console.log('### DoModuleDirectly()');

        // Update
        await task_sbj
            .filter(t => t.includes(_UPDATE_))
            .toPromise()
            .then(function(t) {
                if (t !== undefined && on_doing === true) {
                    return update_manifest(page, info);
                }
            })
            .then(function () {
                if (on_doing === true) {
                    return DoModuleActionDirectly(task_sbj, data_sbj, page, info);
                }
            })
            .then(function () {
                return do_todos(page, info);
            });
    }

    async function DoModuleAction(task_sbj, data_sbj, page, info, may_copy) {
        console.log('### DoModuleAction()');

        return data_sbj
            .toPromise()
            .then(function (data) {
                if (may_copy === true && page.Project() === data[_LOCATE_AT_]) {
                    return CopyModule(page, data);
                } else {
                    return ModuleActionDirectly(task_sbj, data_sbj, page, info, (data[_TO_DO_] === true));
                }
            });
    }

    async function ModuleAction(task_sbj, data_sbj, page, info) {
        console.log('### ModuleAction()');

        // Copy
        await task_sbj
            .filter(t => t.includes(_COPY_))
            .toPromise()
            .then(function (t) {
                if (t === undefined) {
                    return DoModuleAction(task_sbj, data_sbj, page, info, false);
                } else {
                    return DoModuleAction(task_sbj, data_sbj, page, info, true);
                }
            })
            .catch(function (e) {
                return do_todos(page, info);
            });
    }

    async function doRequirementEditionAction(task_sbj, data_sbj, page, info) {
        console.log('### doRequirementEditionAction()');

        await enter_edition(page);

        await task_sbj
            .filter(t => t.includes(_EDIT_))
            .toPromise()
            .then(function (t) {
                if (t !== undefined) {
                    return edit_reqirement(page, data_sbj);
                }
            });

        await task_sbj
            .filter(t => t.includes(_RENAME_))
            .toPromise()
            .then(function (t) {
                if (t !== undefined) {
                    return rename_page(page, data_sbj);
                }
            });

        await task_sbj
            .filter(t => t.includes(_JIRA_))
            .toPromise()
            .then(function (t) {
                if (t !== undefined) {
                    return create_jira(page, data_sbj);
                }
            })
            .then(function () {
                return data_sbj
                    .toPromise()
                    .then(function (data) {
                        return HttpDone(info, data[_PARAM_TABLE_][data[_PARAM_HEADER_][_SERIAL_NUMBER_]]);
                    });
            });

        return save_edition(page);
    }

    function doRequirementTagAction(data_sbj, page) {
        console.log('### doRequirementActionTag()');

        return data_sbj
            .toPromise()
            .then(function (data) {
                if (data !== undefined) {
                    return tag_page(page, data);
                }
            });
    }

    async function doRequirementAction(task_sbj, data_sbj, page, info) {
        console.log('### doRequirementAction()');

        await task_sbj
            .filter(t => t.includes(_TAG_))
            .toPromise()
            .then(function (t) {
                if (t !== undefined) {
                    return doRequirementTagAction(data_sbj, page);
                }
            });

        return task_sbj
            .filter(t => is_edit_reqrm_task(t))
            .take(1)
            .toPromise()
            .then(function (t) {
                if (t !== undefined) {
                    return doRequirementEditionAction(task_sbj, data_sbj, page, info);
                }
            });
    }

    async function RequirementAction(task_sbj, data_sbj, page, info) {
        console.log('### RequirementAction()');

        await data_sbj
            .toPromise()
            .then(function (data) {
                if (data[_TO_DO_] === true) {
                    return doRequirementAction(task_sbj, data_sbj, page, info);
                }
            })
            .then(function () {
                return check_edit_jira(task_sbj, data_sbj, page, info);
            })
            .then(function (t) {
                return do_todos(page, info);
            })
            .catch(function (e) {
                return do_todos(page, info);
            });
    }

    function CallVectorEntry(tasks, project, page, type) {
        console.log('### CallVectorEntry()')

        var info = page.Info();

        var frames = {}
        frames[_PARAM_HEADER_] = ''
        var table = page.TableFor(_SERIAL_)
        if (table.length === 1) {
            frames = page.TableFrame(table)
        }

        var data_sbj = new Rx.ReplaySubject();
        Rx.Observable
            .from(HttpAction(info, frames))
            .map(t => JSON.parse(t))
            .subscribe(data_sbj);

        var task_sbj  = new Rx.ReplaySubject();
        Rx.Observable
            .of(tasks)
            .map(ts => ts[type])
            .subscribe(task_sbj);

        // 所有执行任务的入口
        ActionVectors[type](task_sbj, data_sbj, page, info);
    }

    async function doJobChain(cmd) {
        console.log('### doJobChain()')

        try {
            var type = _O_;
            var page = undefined;
            var tasks = cmd[_TASKS_];
            var project = cmd[_PROJECT_];
        
            for (var i = 5; i > 0; i --) {
                await idle(1.2);
    
                page = new WikiPage(project[_PROJECT_NAME_]);
                type = page.Type();
                if (type !== _O_) {
                    break;
                }
    
                page = new WikiPage(project[_LOCATE_AT_]);
                type = page.Type();
                if (type !== _O_) {
                    break;
                }
            }
    
            if (type !== _O_) {
                CallVectorEntry(tasks, project, page, type);
            } else {
                try {
                    page.close();
                } catch (error) {
                    throw new Error('当前页面不属于目标项目或指定的位置，任务中止。');
                }
            }
        } catch (err) {
            alert(err.message);
        }
    }

    function activation(cmd) {
        console.log('### activation()')

        var button = inject();
        var delay = parseInt(cmd[_PREF_][_WINDOW_])

        var t = Rx.Observable
            .timer(_SECOND_, _SECOND_)
            .take(delay + 1)
            .map(i => delay - i)
            .subscribe(i => button.setAttribute('value', _PAUSE_ + ': ' + (i === undefined ? delay : i)),
                err => console.error('' + err),
                function() {
                    button.setAttribute('value', _PAUSE_); 
                    button.disabled = true;
                    doJobChain(cmd);
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
        console.log('### document ready().');

        var t = Rx.Observable
            .from(http('POST', 'tasks'))
            .map(t => JSON.parse(t));

        var p = Rx.Observable
            .from(http('POST', 'project'))
            .map(t => JSON.parse(t));

        var r = Rx.Observable
            .from(http('POST', 'preference'))
            .map(t => JSON.parse(t));

        Rx.Observable
            .forkJoin(t, p, r, 
                function (t, p, r) {
                    var data = {}
                    data[_TASKS_] = t;
                    data[_PROJECT_] = p;
                    data[_PREF_] = r
                    return data;
                })
            .subscribe(cmd => activation(cmd));
    });
})();

