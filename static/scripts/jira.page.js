
var JiraPage = function() {

    this.Href = function() {
        return window.location.href;
    }

    this.Name = function() {
        return $('h1#title-text>a').text();
    }

    this.wiki_href = function() {
        return $('#description-val > div > p > a')[0].href;
    }

    this.jump = async function(path) {
        window.location.pathname = path;
    }

    this.navigate = async function(href) {
        window.location.href = href;
    }

    this.edit = async function() {
        $('#edit-issue').click();
        await idle(1.5);

        return Promise.resolve(true);
    }

    this.input = async function(which, what) {
        which.focus()
        which.trigger('keydown');
        which.val(what);
        which.trigger('keyup');
        which.trigger('input');
        which.trigger('change');
    }

    this.to_finish = async function() {
        $('#action_id_201').click();
        await idle(1);

        return Promise.resolve(true);
    }

    this.jira = async function(data) {
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

    this.save = async function() {
        $('#edit-issue-submit').click()
        await idle(1.5);''

        return Promise.resolve(true);
    }
}
