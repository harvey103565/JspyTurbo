#! /usr/bin/python3
# -*- coding:utf-8 -*-


import json

from xls.book import Book
from model.interval import Interval


_mission_ = '任务项'
_to_do_ = '待处理'
_url_ = '链接'
_story_ = '故事链接'
_s_ = '编号'
_t_ = '任务'
_p_ = '项目'
_d_ = '目录'
_m_ = '蒙版'
_w_ = '窗口'


class Model(object):
    def __init__(self, argv):
        self.store = Book(argv[1])
        self.cache = dict([(_t_, json.loads(argv[5]))])

        self._t_ = _t_
        self._p_ = _p_
        self._d_ = _d_
        self._m_ = _m_
        self._w_ = _w_
        self._s_ = _s_
        self._url_ = _url_
        self._to_do_ = _to_do_
        self._mission_ = _mission_
        self._story_ = _story_

    def tasks(self) -> list:
        """
        Load the tasks of this applet
        :return: a list of tasks for applet
        """
        return self.cache[self._t_]

    def preference(self) -> dict:
        """
        Get the masking used to map tasks to 3 different level: which are project, module, requirement,
        if it is not loaded into cache, the read it from persist storage
        :return: the dict of masking of 3 levels
        """
        if self._w_ not in self.cache:
            self.cache[self._w_] = self.store.window()

        return {self._w_: self.cache[self._w_]}

    def masking(self) -> dict:
        """
        Get the masking used to map tasks to 3 different level of tasks: which are project, module, requirement,
        if it is not loaded into cache, the read it from persist storage
        :return: the dict of masking of 3 levels
        """
        if self._m_ not in self.cache:
            self.cache[self._m_] = self.store.masking()

        return self.cache[self._m_]

    def project(self) -> dict:
        """
        Get project information, if it is not loaded into cache, the read it from persist storage
        :return: a dict of these information formed as name-value pairs
        """
        if self._p_ not in self.cache:
            self.cache[self._p_] = self.store.project()

        return self.cache[self._p_]

    def has(self, module: str) -> bool:
        return module in self.store

    def add(self, module: str):
        if module not in self.store:
            self.store.add(module)

    def directory(self) -> dict:
        """
        Load the directory of all modules, which is the overview of the project structure,
        if it is not loaded into cache, the read it from persist storage
        :return: a dict contains module_name : entry_info pairs
        """
        if self._d_ not in self.cache:
            self.cache[self._d_] = self.store.directory()

        return self.cache[self._d_]

    def modules(self):
        """
        Load the modules' name in the project as a list, DO NOT cache it so we get them in same order
        :return: the list of names
        """
        return self.store.modules()

    def update_directory(self, modules: list):
        """
        Update the module list of the project, add new entry and remove obsolete ones
        :param modules: the newer list in the project
        :return: <No>
        """
        directory = self.directory()

        self.store.update_directory(directory, modules)
        self.cache[self._d_] = self.store.directory()

    def module_entry(self, module: str) -> dict:
        """
        Get a directory entry of specified module.
        :param module: the module to get
        :return: a dict of the entry
        """
        directory = self.directory()
        if module not in directory:
            raise LookupError('在Excel表格中没有找到 {} 模块.'.format(module))

        return directory[module]

    def modify_entry(self, module: str, entry: dict):
        """
        Modify an entry in module directory
        :param module: the module to get
        :param entry: Module entry that is updated
        :return: a dict of the entry
        """

        directory = self.directory()
        directory[module] = entry

        self.store.save_directory(directory)

    def module_url(self, module: str) -> str:
        """
        Get a url of specified module from directory entry.
        :param module: the module to get
        :return: a dict of the entry
        """
        entry = self.module_entry(module)
        return entry[self._url_]

    def module_done(self, module: str):
        """
        Mark the module as done, write back to-do list into setting string at the same time
        :param module: the module that has been finished
        :return: <No>
        """
        entry = self.module_entry(module)
        entry[self._to_do_] = False

    def module_to_do(self) -> iter:
        directory = self.directory()

        for k, v in directory.items():
            if v[self._to_do_]:
                yield v[self._url_]
                continue

            interval = Model.interval(v, -1)
            if len(interval):
                yield v[self._url_]

    def module_set(self, module: str):
        entry = self.module_entry(module)

        if module in self.store:
            manifest = self.manifest(module)
        else:
            manifest = tuple()

        count = len(manifest)
        if count:
            details = self.requirements(module)
            interval = Model.interval(entry, count)

            items = list(interval.items)
            for index in items:
                name = manifest[index - 1]
                requirement = details[name]

                if not requirement[self._to_do_]:
                    interval.remove(index)

            self.store.save_requirements(module, details)
        else:
            interval = Interval()

        Model.mission(entry, interval)
        self.modify_entry(module, entry)

        if module in self.cache:
            self.cache.pop(module)

    def manifest(self, module: str) -> tuple:
        """
        Load the requirements' name in the module as a list, DO NOT cache it so we get them in same order
        :param module: the module to load
        :return: the list of names
        """
        if module not in self.store:
            raise LookupError('没有在Excel表格中找到 {} 模块页，先执行更新任务。'.format(module))

        return self.store.manifest(module)

    def requirements(self, module: str) -> dict:
        """
        Load the details' DETAILS in specified module
        :param module: the module to load
        :return: requirement's detail
        """
        if module not in self.cache:
            if module not in self.store:
                raise LookupError('没有在Excel表格中找到 {} 模块页，先执行更新任务。'.format(module))

            details = self.store.requirements(module)
            self.cache[module] = details

        return self.cache[module]

    def requirement(self, module: str, requirement: str) -> dict:
        """
        Get the next requirement's url to-do after undo the requirement
        :param module: module that requirement belonged
        :param requirement: requirement to get the detail
        :return: a dict contains detailed information of missions at next requirement in to-do list
        """
        details = self.requirements(module)

        if requirement not in details:
            raise LookupError('在模块页 {} 中没有找到需求: {}'.format(module, requirement))

        return details[requirement]

    def serials(self, module: str) -> set:
        """
        Load occupied serial numbers into a set
        :param module:
        :return:
        """
        details = self.requirements(module)

        return set(r[self._s_] for r in details.values() if r[self._s_])

    def update_requirements(self, module: str, requirements: iter=tuple()):
        """
        Update the requirement list of the module, add new entry and remove obsolete ones
        :param module: the module that requirements belonged
        :param requirements: the newer list in the module
        :return: <No>
        """
        entry = self.module_entry(module)
        interval = Model.interval(entry, len(requirements))

        details = self.requirements(module)
        added = self.store.update_requirements(module, details, requirements)

        manifest = self.manifest(module)
        details = self.store.requirements(module)
        Model.init_achievement(manifest, details, added, interval, self._to_do_)

        self.cache[module] = details

    def requirement_done(self, module: str, requirement: str, serial: str):
        """
        Mark a requirement as finished, and undo the reqistration in module's task list
        :param module: the module that requirement resides
        :param requirement: the requirement that is finished
        :param serial: the serial number given to this requirement
        :return: <No>
        """
        detail = self.requirement(module, requirement)
        detail[self._s_] = serial

        detail[self._to_do_] = False

    def jira_done(self, module: str, requirement: str, url: str):
        """
        Mark a requirement as finished, and undo the reqistration in module's task list
        :param module: the module that requirement resides
        :param requirement: the requirement that is finished
        :param url: url of jira story
        :return: <No>
        """
        detail = self.requirement(module, requirement)
        detail[self._story_] = url

    def requirement_to_do(self, module: str) -> iter:
        """
        Get the next requirement's url to-do after undo the requirement
        :param module: module that requirement belonged
        :return: a generator which traverse over every requirement's url
        """
        entry = self.module_entry(module)
        manifest = self.manifest(module)
        interval = Model.interval(entry, len(manifest))

        details = self.requirements(module)

        for index in interval:
            name = manifest[index - 1]
            detail = details[name]
            yield detail[self._url_]

    def training_set(self):
        return self.store.training_set()

    @staticmethod
    def init_achievement(manifest: iter, requirements: dict, news: set, todos: Interval, key: str=_to_do_):
        """
        Tools function. Mark the requirement as finished using the to-do expression
        :param manifest: the manifest of requirements in module
        :param requirements: the detailed requirement info
        :param news: new requirements need to by init
        :param todos: the interval object that represents the to-do expression
        :param key: the key that to_do status is stored in dictionary
        :return: <No>
        """
        for index, requirement in enumerate(manifest):
            if requirement not in news:
                continue

            detail = requirements[requirement]
            if index + 1 in todos:
                detail[key] = True
            else:
                detail[key] = False

    @staticmethod
    def interval(entry: dict, limit: int = -1, source: str=_mission_) -> Interval:
        """
        Tools function: get the interval object stored in requirement details
        :param entry: the entry of requirement info
        :param limit: The upper limitation of this interval
        :param source: the source position that interval expression comes from
        :return: the interval object
        """
        return Interval(entry[source], limit)

    @staticmethod
    def mission(entry: dict, interval: Interval, source: str=_mission_):
        """
        Tools function: write back the interval object stored in requirement details
        :param entry: the entry of requirement info
        :param interval: the interval object to write back
        :param source: the source position that interval expression comes from
        :return: <NA>
        """
        entry[source] = interval.to_expr()
