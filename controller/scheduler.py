#! /usr/bin/python3
# -*- coding:utf-8 -*-

from model.packer import Packer

from model.packer import _m_
from model.packer import _r_

from model.constants import page_url_ as _page_url_


class Scheduler(object):
    def __init__(self, model, _project_: str= '项目', _module_: str= '模块', _requirement_: str= '需求'):
        self.model = model
        self.packer = Packer(model)
        self.doing = dict()
        self.jiras = dict()
        self.modules = set()

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

        if module:
            mod = self.packer.purify(module)
            reqs = self.requirement_to_do(mod)

            try:
                todo[_page_url_] = next(reqs)
                return todo
            except StopIteration:
                self.model.module_set(mod)
                self.packer.module_set(mod)
                self.doing.pop(mod)

        mods = self.module_to_do()
        try:
            todo[_page_url_] = next(mods)
        except StopIteration:
            self.finish_all()
            todo[_page_url_] = ''

        return todo

    def finish_all(self):
        for mod in self.modules:
            self.model.module_set(mod)
            self.packer.module_set(mod)

    def done(self, module: str='', requirement: str= '', serial: str=''):
        mod = self.packer.purify(module)

        self.modules.add(mod)

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

        if req:
            params = self.compose_requirement(mod, req, headers)
        else:
            params = self.compose_module(mod)

        if not argus:
            self.packer.record(module, req, params)

        return params

    def jira(self, url, data: dict):
        self.jiras[url] = data

    def jira_done(self, url):
        argus = self.jiras.pop(url)

        module = argus[_m_]
        requirement = argus[_r_]

        mod = self.packer.purify(module)
        rinser = self.packer.module_rinser(mod)
        req = rinser.purify(requirement)

        self.model.jira_done(mod, req, url)

    def query_jira(self, url):
        return self.jiras[url]

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
        composer.extend(entry)

        composer.compose(mod)

        return composer.params()

    def compose_requirement(self, module, requirement, headers):
        mod = self.packer.purify(module)
        entry = self.model.module_entry(mod)

        composer = self.packer.module_composer(module)
        req_name = composer.purify(requirement)

        detail = self.model.requirement(mod, req_name)
        composer.extend(entry)
        composer.extend(detail)

        composer.compose(req_name, headers)

        return composer.params()
