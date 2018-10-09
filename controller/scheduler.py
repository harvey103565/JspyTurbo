#! /usr/bin/python3
# -*- coding:utf-8 -*-

from model.packer import Packer

from model.packer import _m_
from model.packer import _r_

from model.constants import page_url_ as _page_url_
from model.constants import to_do_ as _to_do_


class Scheduler(object):
    def __init__(self, model, _project_: str= '项目', _module_: str= '模块', _requirement_: str= '需求'):
        self.model = model
        self.packer = Packer(model)
        self.doing = dict()
        self.jiras = dict()
        self.actions = dict()

        self._project_ = _project_
        self._module_ = _module_
        self._requirement_ = _requirement_

    def tasks(self):
        masking = self.model.masking()
        t = set(self.model.tasks())

        return dict((k, list(set(v.split(',')) & t)) for (k, v) in masking.items())

    def module_to_do(self):
        if self._module_ not in self.doing:
            doing = self.model.module_to_do()
            self.doing[self._module_] = doing

        return self.doing[self._module_]

    def requirement_to_do(self, module: str) -> iter:
        if module not in self.doing:
            doing = self.model.requirement_to_do(module)

            self.doing[module] = doing

        return self.doing[module]

    def todo(self, module: str='') -> dict:
        """
        Get next thing to do for current page
        :param module: current module
        """
        todo = dict()
        todo[_page_url_] = ''

        if module:
            mod = self.packer.purify(module)
            reqs = self.requirement_to_do(mod)

            try:
                todo[_page_url_] = next(reqs)
                return todo
            except StopIteration:
                self.module_set(mod, module)

        mods = self.module_to_do()
        try:
            todo[_page_url_] = next(mods)
        except StopIteration:
            self.finish_all()

        return todo

    def finish_all(self):
        self.doing.clear()
        self.actions.clear()

    def module_set(self, mod: str, module: str):
        self.model.module_set(mod)
        self.packer.module_set(mod)

        self.doing.pop(mod)
        entry = self.actions.pop(module)
        entry.clear()

    def done(self, module: str='', requirement: str= '', serial: str=''):
        mod = self.packer.purify(module)

        params = self.get_cached_action(module, requirement)
        if params:
            params[_to_do_] = False

        if requirement:
            composer = self.packer.module_composer(module)
            req_name = composer.purify(requirement)
            self.model.requirement_done(mod, req_name, serial)
        else:
            self.model.module_done(mod)

    def action(self, module: str, requirement: str, headers: list) -> dict:
        """
        Get the actions to applied by client
        :param module: the module from client
        :param requirement: the requirement from client
        :param headers: the headers of table
        :return: a dict contains actions to applied
        """
        # Find out if we have proceed this page
        argus = None
        try:
            argus = self.packer.find(module, requirement)
            mod = argus[_m_]
            req = argus[_r_]
        except KeyError:
            mod = module
            req = requirement

        params = self.get_cached_action(mod, req)
        if not params:
            if req:
                params = self.compose_requirement(mod, req, headers)
            else:
                params = self.compose_module(mod)

        if not argus:
            self.packer.record(module, req, params)

        return params

    def jira(self, url, info: dict) -> bool:
        """
        Record a jira
        :param url: jira url
        :param info: module and requirement tittle in raw
        :return:
        """
        if url in self.jiras:
            return False

        self.jiras[url] = info
        return True

    def jira_done(self, url):
        argus = self.jiras.pop(url)

        mod = self.packer.purify(argus[_m_])
        rinser = self.packer.module_rinser(mod)

        req = rinser.purify(argus[_r_])

        self.model.jira_done(mod, req, url)

    def query_jira(self, url):
        info = self.jiras[url]

        mod = info[_m_]
        req = info[_r_]

        params = self.get_cached_action(mod, req)
        params.update(info)

        return params

    def update_directory(self, modules: iter=tuple()):
        """
        Update directory of modules
        :param modules: List of Modules (name, url)
        :return:
        """

        entry = list([self.packer.purify(r[0]), r[1]] for r in modules)

        self.model.update_directory(entry)

    def update_requirements(self, module: str='', requirements: iter=tuple()):
        """

        :param module:
        :param requirements:
        :return:
        """
        mod = self.packer.purify(module)

        if not self.model.has(mod):
            self.model.add(mod)

        rinser = self.packer.module_rinser(mod)
        entry = list([rinser.purify(r[0]), r[1]] for r in requirements)

        return self.model.update_requirements(mod, entry)

    def compose_module(self, module):
        mod = self.packer.purify(module)
        entry = self.model.module_entry(mod)

        composer = self.packer.composer()
        data = composer.compose(mod, entry)

        self.cache_action(module, None, data)

        return data

    def compose_requirement(self, module, requirement, headers):
        mod = self.packer.purify(module)
        entry = self.model.module_entry(mod)

        composer = self.packer.module_composer(module)
        req = composer.purify(requirement)

        detail = self.model.requirement(mod, req)
        data = composer.compose(req, entry, detail, headers=headers)

        self.cache_action(module, requirement, data)

        return data

    def cache_action(self, mod, req, data):
        if mod not in self.actions:
            self.actions[mod] = dict()

        mod_entry = self.actions[mod]

        if req:
            if req not in mod_entry:
                mod_entry[req] = data
        else:
            mod_entry[_m_] = data

    def get_cached_action(self, module, requirement):
        if module not in self.actions:
            return None

        mod_entry = self.actions[module]
        if not requirement:
            return mod_entry[_m_]
        elif requirement in mod_entry:
            return mod_entry[requirement]
        else:
            return None

