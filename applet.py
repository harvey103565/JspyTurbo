#! /usr/bin/python3
# -*- coding:utf-8 -*-

import json
import sys
import logging as log

from flask import Flask
from flask import request
from flask import url_for

from config import Port
from config import Host
from model.core import Model
from controller.scheduler import Scheduler


app = Flask(__name__)

model = Model(sys.argv)
scheduler = Scheduler(model)


@app.route('/tasks', methods=['POST'])
def tasks():
    log.debug('POST:/tasks')
    try:
        data = scheduler.tasks()
        return json.dumps(data)
    except LookupError as e:
        log.error(repr(e))
        log.exception(str(e), exc_info=True, stack_info=True)
        return {'Done': 'false', 'Logging': 'repr(e)'}, 503


@app.route('/todo', methods=['POST'])
def todo():
    log.debug('POST:/todo')

    try:
        params = request.get_json()
        module = params['module']

        try:
            data = scheduler.todo(module)
        except LookupError as e:
            log.exception(str(e), exc_info=True, stack_info=True)
            data = scheduler.todo('')
        return json.dumps(data)
    except Exception as e:
        log.error(repr(e))
        log.exception(str(e), exc_info=True, stack_info=True)
        return {'Done': 'false', 'Logging': 'repr(e)'}, 503


@app.route('/done', methods=['POST'])
def done():
    log.debug('POST: /done')

    try:
        params = request.get_json()
        module = params['module']
        requirement = params['requirement']
        serial = params['serial']

        scheduler.done(module, requirement, serial)
        return '{"Done": "true", "Logging": "Done"}'
    except Exception as e:
        log.error(repr(e))
        log.exception(str(e), exc_info=True, stack_info=True)
        return {'Done': 'false', 'Logging': 'repr(e)'}, 503


@app.route('/action', methods=['POST'])
def action():
    log.debug('POST:/action')

    try:
        params = request.get_json()
        module = params['module']
        if module:
            requirement = params['requirement']
            table = params['header']
            data = scheduler.action(module, requirement, table)
        else:
            data = dict()
        return json.dumps(data)
    except Exception as e:
        log.error(repr(e))
        log.exception(str(e), exc_info=True, stack_info=True)
        return {'Done': 'false', 'Logging': 'repr(e)'}, 503


@app.route('/jira', methods=['POST'])
def jira():
    log.debug('POST:/jira')

    try:
        params = request.get_json()
        url = params['url']

        scheduler.jira(url, params)
        return '{"Done": "true", "Logging": "Done"}'
    except Exception as e:
        log.error(repr(e))
        log.exception(str(e), exc_info=True, stack_info=True)
        return {'Done': 'false', 'Logging': 'repr(e)'}, 503


@app.route('/jira_done', methods=['POST'])
def jira_done():
    log.debug('POST:/jira_done')

    try:
        params = request.get_json()
        url = params['url']

        scheduler.jira_done(url)
        return '{"Done": "true", "Log": "Done"}'
    except Exception as e:
        log.error(repr(e))
        log.exception(str(e), exc_info=True, stack_info=True)
        return {'Done': 'false', 'Logging': 'repr(e)'}, 503


@app.route('/query_jira', methods=['POST'])
def query_jira():
    log.debug('POST:/query_jira')

    try:
        params = request.get_json()
        url = params['url']

        data = scheduler.query_jira(url)
        return json.dumps(data)
    except Exception as e:
        log.error(repr(e))
        log.exception(str(e), exc_info=True, stack_info=True)
        return {'Done': 'false', 'Logging': 'repr(e)'}, 503


@app.route('/directory', methods=['POST'])
def update_directory():
    log.debug('POST: /directory')

    try:
        params = request.get_json()
        modules = params['modules']
        scheduler.update_directory(modules)

        return '{"Done": "true", "Logging": "Done"}'
    except Exception as e:
        log.error(repr(e))
        log.exception(str(e), exc_info=True, stack_info=True)
        return {'Done': 'false', 'Logging': 'repr(e)'}, 503


@app.route('/manifest', methods=['POST'])
def update_manifest():
    log.debug('POST: /manifest')

    try:
        params = request.get_json()
        module = params['module']
        requirements = params['requirements']

        scheduler.update_requirements(module, requirements)
        return '{"Done": "true", "Logging": "Done"}'
    except Exception as e:
        log.error(repr(e))
        log.exception(str(e), exc_info=True, stack_info=True)
        return {'Done': 'false', 'Logging': 'repr(e)'}, 503


@app.route('/preference', methods=['POST'])
def preference():
    log.debug('POST:/preference')

    try:
        data = model.preference()
        return json.dumps(data)
    except Exception as e:
        log.error(repr(e))
        log.exception(str(e), exc_info=True, stack_info=True)
        return {'Done': 'false', 'Logging': 'repr(e)'}, 503


@app.route('/project', methods=['POST'])
def project():
    log.debug('POST:/project')

    try:
        data = model.project()
        return json.dumps(data)
    except Exception as e:
        log.error(repr(e))
        log.exception(str(e), exc_info=True, stack_info=True)
        return {'Done': 'false', 'Logging': 'repr(e)'}, 503


@app.route('/scripts')
def scripts():

    static_file = {
        'wiki_js': url_for('static', filename='scripts/wiki.user.js'),
        'jira_js': url_for('static', filename='scripts/jira.user.js')
    }

    return '''<html>
        <h1>安装脚本</h1>
        <body>
            <p>安装用于Wiki系统的脚本：</p>
            <a href="{wiki_js}">Wiki 脚本</a>
            <p>安装用于Jira系统的脚本：</p>
            <a href="{jira_js}">Jira 脚本</a>
            <p>Jira系统的脚本用于在jira.zte.com.cn系统中执行包含Jira任务的批量处理。</p>
        </body>
        </html>'''.format(**static_file)


@app.route('/hi')
def hi():
    return '<html><h1>hi :)</h1></html>'


@app.route('/bye', methods=['PUT'])
def bye():
    log.debug('PUT: /bye')

    func = request.environ.get('werkzeug.server.shutdown')
    if func is None:
        raise RuntimeError('Not running with the Werkzeug Server.')
    func()


app.run(Host, int(Port))

