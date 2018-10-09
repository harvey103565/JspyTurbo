
var WikiPage = function(project) {
    this.Href = function() {
        return window.location.href;
    }

    this.Name = function() {
        return $('h1#title-text > a').text();
    }

    this.StoryHref = function(story) {
        return story.find('a.jira-issue-key').attr('href');
    }

    this.Root = function() {
        this.current = this.root;
    }

    this.Branch = function(key) {
        var element = $(`li > div > span > a:contains("${key}")`).closest('li').get(0);
        this.current = $(element);
        return this.current;
    }

    this.HighLightten = function() {
        this.current = $("span.plugin_pagetree_current").closest('li');
        return this.current;
    }

    this.BranchName = function() {
        return this.current.find('div:eq(1) > span > a').text();
    }

    this.Project = function() {
        return this.root.find('div:eq(1) > span > a').text();
    }

    this.Leaves = function() {
        var array = [];
        
        var branches = this.current.find('div:eq(2) > ul > li');
        branches.find('div:eq(1) > span > a').each((i, e) => array[i] = [e.innerText, e.href]);

        return array;
    }

    this.Parent = function() {
        if (this.IsRoot()) {
            throw new Error('Current is the root.');
        }

        var start = this.current.parent();

        this.current = start.closest('li');
    }

    this.IsRoot = function() {
        return this.current.is(this.root);
    }

    this.Type = function() {
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

    this.Info = function() {
        var info = {}
        info[_PARAM_MODULE_] = this.module;
        info[_PARAM_REQUIREMENT_] = this.requirement
        return info;
    }

    this.TableFor = function(text, seqn, conext) {
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

    this.TableFrame = function(table) {
        var rows = table.find('tr');
        var headers = new Array();
        var frame = {}

        rows.each(function (i, e) {
            headers[i] = $(e).find('*:first').text()
        });

        frame[_PARAM_HEADER_] = headers;
        return frame;
    }

    this.jump = function(path) {
        window.location.pathname = path;
    }

    this.navigate = function(href) {
        window.location.href = href;
    }

    this.macro = function(which, what) {
        var h = `<div class="content-wrapper"><p><img class="editor-inline-macro" height="18" width="88" src="/plugins/servlet/status-macro/placeholder?title=aaa&amp;colour=Green" data-macro-name="status" data-macro-parameters="colour=Green|title=${what}" data-macro-schema-version="1"></p></div>`
        which[0].innerHTML = h;
    }

    this.edit = async function() {
        await dom_trigger('#content', 
            function (mutation) {
                return true;
            },
            {'childList': true, 'subtree': false},
            $('#editPageLink'),
            element => element.click());

        return idle(0.6);
    }

    this.rename = async function(text) {
        $('#content-title').val(text);
        await idle(0.8);

        var sub_title = $('#tinymce > p:nth-child(2) > span:contains("页面名称")', $("#wysiwygTextarea_ifr").contents());
        if (sub_title !== undefined) {
            sub_title.empty();
        }

        return idle(0.8);
    }

    this.fill = async function(data) {
        var contents = $("#wysiwygTextarea_ifr").contents()
        var table1 = this.TableFor(_SERIAL_, undefined, contents);
        var table3 = this.TableFor(_EDITOR_, undefined, contents)

        var count = table1.children('tr').length;
        var contents = data[_PARAM_TABLE_];
        var headers = data[_PARAM_HEADER_];
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

                if (header === headers[_JIRA_STORY_]) {
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

            var c1 = row.children('td:nth-child(1)')
            var c2 = row.children('td:nth-child(2)') 
            var p = c1.text();
            var d = c2.text();
            c1.empty();
            c2.empty();
            if ((p !== '' && d !== '') && (p !== undefined && d !== undefined) && (p !== null && d !== null)) {
                c1.text(owner);
                c2.text(date);
            }
        }

        return idle(1.6);
    }

    this.tag = async function(tagserial, deletes, modification) {
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

    this.copy = async function(data, former_name) {
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

    this.jira = async function(data) {
        var contents = $("#wysiwygTextarea_ifr").contents()
        var table1 = this.TableFor(_SERIAL_, undefined, contents);

        var count = table1.children('tr').length;
        var contents = data[_PARAM_TABLE_];
        var headers = data[_PARAM_HEADER_];
        var jira_header = headers[_JIRA_STORY_];
        var jira = undefined
        for (var i = 0; i < count; i ++) {
            var row = table1.children(`tr:nth-child(${i + 1})`);
            var header = row.children('*:first').text()

            if (header === jira_header) {
                jira = row.children('td:nth-child(2)');
                break;
            }
        }

        if (jira === undefined) {
            alert('不能支持在当前页面格式下创建Jira任务。')
            return;
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

    this.save = async function() {
        $('#notifyWatchers').prop('checked', false);
        await idle(1);

        $('#rte-button-publish').click()

        // 等待一小时并报错
        await idle(60*60);
        return Promise.reject(Error('保存编辑超时，重新点击需求链接重试。'));
    }

    this.close = async function() {
        $('#rte-button-cancel').click();

        // 等待一小时并报错
        await idle(60*60);
        return Promise.reject(Error('保存编辑超时，重新点击需求链接重试。'));
    }

    this.replace_story = function(which, what, name) {
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

    this.input = function(which, what) {
        which.focus()
        which.trigger('keydown');
        which.val(what);
        which.trigger('keyup');
        which.trigger('input');
        which.trigger('change');
    }

    this.story = function(jira_header) {
        var table = this.TableFor(jira_header)
        if (table.length === 1) {
            var count = table.children('tr').length;
            for (var i = 0; i < count; i ++) {
                var row = table.children(`tr:nth-child(${i + 1})`);
                var header = row.children('*:first').text()

                if (header === jira_header) {
                    var text = "需求编写中"
                    // var text = _PARAM_WRITING_
                    var span = row.find(`span:contains("${text}")`)
                    if (span.length > 0) {
                        return span.closest('span.jira-issue').last()
                    }
                }
            }
        }
        return undefined;
    }

    this.root = this.Branch(project);
    this.current = this.root;

    this.module = ''
    this.requirement = ''

}
