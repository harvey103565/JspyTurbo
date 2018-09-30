#! /usr/bin/python3
# -*- coding:utf-8 -*-

import re

from fuzzywuzzy import process
from model.core import Model
from model.vsclsfir import VSClsfir

from model.constants import draw_module_ as _draw_module_
from model.constants import draw_requirement_ as _draw_requirement_
from model.constants import generate_serial_ as _generate_serial_
from model.constants import serial_number_ as _serial_number_
from model.constants import requirement_naming_ as _requirement_naming_
from model.constants import module_naming_ as _module_naming_
from model.constants import project_name_ as _project_name_
from model.constants import code_name_ as _code_name_
from model.constants import former_prefix_ as _former_prefix_
from model.constants import operator_ as _operator_
from model.constants import revision_ as _revision_
from model.constants import priority_ as _priority_
from model.constants import feature_property_ as _feature_property_
from model.constants import feature_state_ as _feature_state_
from model.constants import feature_source_ as _feature_source_
from model.constants import feature_prerequisite_ as _feature_prerequisite_
from model.constants import feature_owner_ as _feature_owner_
from model.constants import jira_story_ as _jira_story_
from model.constants import ui_wireframe_ as _ui_wireframe_
from model.constants import delivered_version_ as _delivered_version_
from model.constants import delivered_state_ as _delivered_state_
from model.constants import module_name_ as _module_name_
from model.constants import abbreviation_ as _abbreviation_
from model.constants import tag_ as _tag_
from model.constants import tags_ as _tags_
from model.constants import tag_serial_ as _tag_serial_
from model.constants import assignee_ as _assignee_
from model.constants import multi_assignee_ as _multi_assignee_
from model.constants import reportee_ as _reportee_
# from model.constants import page_url_ as _page_url_
from model.constants import requirement_name_ as _requirement_name_
from model.constants import requirement_source_ as _requirement_source_
from model.constants import requirement_content_ as _requirement_content_
from model.constants import page_outline_ as _page_outline_
from model.constants import to_space_ as _to_space_
from model.constants import locate_at_ as _locate_at_
from model.constants import to_do_ as _to_do_



match = (
    _draw_module_,
    _draw_requirement_,
    _serial_number_,
    _requirement_naming_,
    _module_naming_,
    _generate_serial_)

configure = (
    _project_name_,
    _code_name_,
    _former_prefix_,
    _operator_,
    _revision_,
    _priority_,
    _feature_property_,
    _feature_state_,
    _feature_source_,
    _feature_prerequisite_,
    _feature_owner_,
    _jira_story_,
    _ui_wireframe_,
    _delivered_version_,
    _delivered_state_,
    _module_name_,
    _abbreviation_,
    _tag_,
    _tags_,
    _to_space_,
    _locate_at_)

action = (
    _module_name_,
    _abbreviation_,
    _tag_,
    _assignee_,
    _multi_assignee_,
    _reportee_,
    _operator_,
    _revision_,
    _serial_number_,
    _requirement_name_,
    _requirement_source_,
    _requirement_content_)

record = (
    _page_outline_,
    _module_name_,
    _serial_number_,
    _requirement_name_)

table_keys = (
    _serial_number_,
    _requirement_name_,
    _priority_,
    _feature_property_,
    _feature_state_,
    _feature_source_,
    _feature_prerequisite_,
    _feature_owner_,
    _delivered_version_,
    _jira_story_,
    _ui_wireframe_,
    _delivered_state_)

_m_ = 'module'
_r_ = 'requirement'
_t_ = 'table'
_h_ = 'header'


class Rinser(object):
    def __init__(self, pattern: str, data: dict, clsfir: VSClsfir):
        if pattern and data:
            drawer = Packer.pattern(pattern, data)
            self.drawer = re.compile(drawer)
        else:
            self.drawer = None

        self.clsfir = clsfir

    def purify(self, name: str):
        if self.drawer:
            result = self.drawer.match(name)

            if result and result.groups() > 1:
                word = result.group(1)
                return word.strip()

        return self.clsfir.classify(name)


class Serializer(object):
    def __init__(self, pattern: str, data: dict, occupieds: set):
        self.occupieds = occupieds
        self.serialization = Serializer.serialization(1, pattern, data, occupieds)

    def serialnum(self) -> str:
        serialnum = next(self.serialization)
        self.occupieds.add(serialnum)
        return serialnum

    @staticmethod
    def serialization(init: int, pattern: str, data: dict, occupied: iter) -> str:
        """
        Create a generator that generates serial number and exclude those already existed in occupieds
        :param init: init value that serialnum starts
        :param pattern: string composition to format the serial string
        :param data: extra data used to format string
        :param occupied: existing serial strings that is already occupied
        :return: a new serial string
        """
        sn = init
        while True:
            ss = pattern.format(sn, **data)
            if ss not in occupied:
                yield ss
            sn += 1


class Composer(object):
    def __init__(self, composition: str, name: str, data: dict,
                 serialnum: str = _serial_number_,
                 rinser: Rinser=None, serializer: Serializer=None):
        """
        Create Composer object
        :param composition: the prototype that is used to generate out string specified by out
        :param name: name field key, module/requirement name string will be put into data with this key after rinsed
        :param data: basic data that will be used
        :param serialnum: serial number string key name
        :param rinser: Rinser object that is going to be used to deal with the name
        :param serializer: Serializer object that is going to be used to generate serial numbers
        """
        self._t_ = _t_
        self._h_ = _h_
        self.composition = composition
        self.name = name
        self.rinser = rinser
        self.data = data
        self.serialnum = serialnum
        self.serializer = serializer

    def compose(self, name: str, *exts: dict, headers: list=None):
        """
        The final step to generate outline, module/requirement name is used as parameter input
        :param name: name of module or requirement
        :param headers: the headers of table
        :return: <NA>
        """
        data = self.data.copy()

        for e in exts:
            data.update(e)

        if self.serializer and data[_to_do_]:
            serialnum = self.serializer.serialnum()
            data[self.serialnum] = serialnum

        data[self.name] = name
        outline = Packer.pattern(self.composition, data)
        data[_page_outline_] = outline

        data[_tag_serial_] = self.tags()

        if headers:
            Composer.mirror_table(data, self._t_, self._h_, table_keys, headers)

        return data

    def purify(self, name: str) -> str:
        """
        Clean input name of module or requirement
        :param name: name of module or requirement
        :return: the name that is drawn out of the name
        """
        if not self.rinser:
            raise AssertionError('服务器错误, 没有为 {} 指定名称提取器.'.format(name))

        return self.rinser.purify(name)

    def tags(self) -> str:
        pattern = self.data[_tags_]
        return pattern.format(**self.data)

    @staticmethod
    def mirror_table(data: dict, content: str, header: str, keys: tuple, raw_keys: list):
        contents = dict()
        headers = dict()

        if not data[_jira_story_]:
            data[_jira_story_] = data[_page_outline_]

        for key in keys:
            if key in data:
                similar = process.extractOne(key, raw_keys)
                if not similar:
                    raise LookupError('在页面表格中没有找到包含{0}的行。'.format(key))

                new_key = similar[0]
                contents[new_key] = data[key]
                headers[key] = new_key

        data[content] = contents
        data[header] = headers


class Packer(object):
    def __init__(self, model: Model):
        self._m_ = _m_
        self._r_ = _r_

        self.model = model
        self.project = model.project()
        self.matchers = Packer.filter(match, self.project)
        self.config = Packer.filter(configure, self.project)

        self.records = dict()

        data = self.model.training_set()
        self.clsfir = VSClsfir(data)
        self.clsfir.train()

        self.rinsers = dict()
        rinser = self.rinser(_draw_module_)

        serializer = self.serializer(_generate_serial_, self.config)
        composer = Composer(self.matchers[_module_naming_], _module_name_, self.config,
                            rinser=rinser, serializer=serializer)
        self.composers = dict([(self._m_, composer)])

    def module_composer(self, module: str) -> Composer:
        mod = self.purify(module)
        entry = self.model.module_entry(mod)

        if mod not in self.composers:
            rinser = self.module_rinser(mod)

            data = Packer.filter(configure, self.config, entry)
            serializer = self.serializer(_generate_serial_, data, mod)

            composer = Composer(self.matchers[_requirement_naming_], _requirement_name_,
                                data, rinser=rinser, serializer=serializer)
            self.composers[mod] = composer

        return self.composer(mod)

    def module_rinser(self, module: str) -> Rinser:
        return self.rinser(_draw_requirement_, module)

    def composer(self, which: str=_m_):
        return self.composers[which]

    def rinser(self, draw: str, module: str=_m_) -> Rinser:
        data = self.project
        if not module == self._m_:
            entry = self.model.module_entry(module)
            data = Packer.filter(configure, data, entry)

        if module not in self.rinsers:
            self.rinsers[module] = Rinser(self.matchers[draw], data, self.clsfir)

        return self.rinsers[module]

    def purify(self, name: str, module: str=_m_) -> str:
        return self.rinsers[module].purify(name)

    def serializer(self, key: str, data: dict, module: str=None):
        """
        Create a Serializer object
        :param key: the name used to select prototype
        :param data:
        :param module: module name that the serializer will be used, used to get the
        :return: the serializer object for moudle
        """
        if module:
            occupieds = self.model.serials(module)
        else:
            occupieds = set()
        return Serializer(self.matchers[key], data, occupieds)

    def record(self, module, requirement, params):
        """
        Record raw info of a page
        :param module: module name in raw
        :param requirement: requirement in raw
        :param params: data
        :return: NA
        """
        r = Packer.filter(record, params)
        r[self._m_] = module
        r[self._r_] = requirement

        for k in record:
            if k not in r:
                r[k] = None

        mod = self.purify(module)
        if mod not in self.records:
            mr = dict()
            self.records[mod] = mr
        else:
            mr = self.records[mod]
        mr[r[_page_outline_]] = r

    def find(self, module, requirement):
        """
        Find raw info of a page
        :param module: module name in raw
        :param requirement: requirement in raw
        :return:
        """
        mod = self.purify(module)
        mr = self.records[mod]

        if requirement:
            return mr[requirement]
        else:
            return mr[module]

    def module_set(self, module):
        """
        All for a module have been finished.
        :param module: the module name
        :return: NA
        """
        if module in self.records:
            self.records.pop(module)

        if module in self.rinsers:
            self.rinsers.pop(module)

        if module in self.composers:
            self.composers.pop(module)

    @staticmethod
    def pattern(proto: str, variables: dict) -> str:
        return proto.format(**variables)

    @staticmethod
    def filter(mask: iter, *data: dict) -> dict:
        """
        Filter out values in several dictionaries, by keys in mask and merge the result into one
        :param mask: the keys whose value will be kept
        :param data: a tuple of dictionaries
        :return: a dictionary contains all keys which is listed in mask
        """
        return {k: v for d in data for k, v in d.items() if k in mask}
