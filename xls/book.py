#! /usr/bin/python3
# -*- coding: utf-8 -*-

import xlwings as xw
import logging as log

from os import path

from xlwings._xlwindows import App
from xlwings._xlwindows import COMRetryObjectWrapper

from win32com.client import Dispatch


_module_ = '模块名'
_outline_ = '标题'

_url_ = '链接'
_setting_ = '设置'
_project_ = '项目'
_directory_ = '目录'
_training_set_ = '训练集'
_conf_ = 'D30'
_window_ = 'D32'
_mask_ = 'D34'
_address_ = 'A1'
_isolation_ = '='

_template_ = '需求模板'


class Book(object):
    def __init__(self, xls):
        self.book = Book.try_app(xls)

        self._template_ = _template_

        self._setting_ = _setting_
        self._project_ = _project_
        self._directory_ = _directory_
        self._conf_ = _conf_
        self._window_ = _window_
        self._mask_ = _mask_
        self._address_ = _address_
        self._isolation_ = _isolation_

    def __contains__(self, module: str):
        return module in [sht.name for sht in self.book.sheets]

    def window(self) -> str:
        """
        load masking settings stored in excel.
        :return:  a dictionary contains global masking name and values
        """
        sheet = self.book.sheets[self._setting_]
        return sheet.range(self._window_).value

    def masking(self) -> dict:
        """
        load masking settings stored in excel.
        :return:  a dictionary contains global masking name and values
        """
        sheet = self.book.sheets[self._setting_]
        expr = self.book.sheets[self._setting_].range(self._mask_).value
        return Book.load_mapping(sheet, expr, self._isolation_)

    def project(self) -> dict:
        """
        load project settings stored in excel.
        :return:  a dictionary contains global setting name and values
        """
        sheet = self.book.sheets[self._project_]
        expr = self.book.sheets[self._setting_].range(self._conf_).value
        return Book.load_mapping(sheet, expr)

    def directory(self) -> dict:
        """
        load directory of modules and their module level parameters
        :return: a dictionary with module names as name and another dictionary of module name, value pairs as value
        """
        directory = dict()

        sheet = self.book.sheets[self._directory_]
        used = Book.used_range(sheet)

        for row in used[1:]:
            directory[row[0]] = dict(zip(used[0], row))

        return directory

    def modules(self) -> tuple:
        """
        load the modules name one by one
        :return: list of modules names
        """
        sheet = self.book.sheets[self._directory_]
        used = Book.used_range(sheet)

        return tuple(row[0] for row in used[1:])

    def update_directory(self, directory: dict, modules: iter=tuple()):
        origin = set(self.modules())
        new = set(m[0] for m in modules)

        sheet = self.book.sheets[self._directory_]
        used = Book.used_range(sheet)

        if not origin:
            Book.dump_column(sheet, new, self._address_)

        if origin:
            directory = Book.update_dictionary(directory, used[0], new - origin, origin - new)
        else:
            directory = self.directory()

        directory = Book.merge_to_dictionary(directory, modules)

        Book.dump_dictionary(sheet, directory, self._address_)

    def save_directory(self, directory: dict):
        sheet = self.book.sheets[self._directory_]
        Book.dump_dictionary(sheet, directory, self._address_)

    def manifest(self, module: str) -> tuple:
        sheet = self.book.sheets[module]
        used = Book.used_range(sheet)

        return tuple(row[0] for row in used[1:])

    def requirements(self, module: str) -> dict:
        details = dict()

        sheet = self.book.sheets[module]
        used = Book.used_range(sheet)

        for row in used[1:]:
            details[row[0]] = dict(zip(used[0], row))

        return details

    def update_requirements(self, module: str, details, requirements: iter=tuple()) -> set:
        origin = set(self.manifest(module))
        new = set(r[0] for r in requirements)

        sheet = self.book.sheets[module]
        used = Book.used_range(sheet)

        if not origin:
            Book.dump_column(sheet, new, self._address_)
            details = self.requirements(module)

        if origin:
            details = Book.update_dictionary(details, used[0], new - origin, origin - new)

        details = Book.merge_to_dictionary(details, requirements, name=_outline_)
        Book.dump_dictionary(sheet, details, self._address_)

        return new

    def save_requirements(self, module: str, details: dict):
        sheet = self.book.sheets[module]
        Book.dump_dictionary(sheet, details, self._address_)

    def add(self, module: str):
        name = self.book.sheets[-1].name
        self.book.sheets.add(module, after=name)

        template = self.book.sheets[self._template_]
        Book.init_template(template, self.book.sheets[module], self._address_)

    def training_set(self):
        sheet = self.book.sheets[_training_set_]
        return sheet.impl.xl.usedRange()

    @staticmethod
    def load_mapping(sheet, expr, separator: str=_isolation_):
        index = dict(p.split(separator) for p in expr.split(','))
        return dict(((sheet.range(k).value, sheet.range(v).value) for (k, v) in index.items()))

    @staticmethod
    def dump_column(sheet, column: iter, address: str=_address_):
        used = Book.used_range(sheet)

        index = used[0]
        sheet.clear()
        cells = list([index])

        for cell in column:
            row = ['' for i in index]
            row[0] = cell
            cells.append(row)

        sheet.range(address).value = cells

    @staticmethod
    def dump_dictionary(sheet, directory: dict, address: str=_address_):
        used = Book.used_range(sheet)

        index = used[0]
        sheet.clear()
        cells = list([index])

        for k, v in directory.items():
            cells.append([v[i] for i in index])

        sheet.range(address).value = cells

    @staticmethod
    def merge_to_dictionary(dictionary, data: iter, name: str=_module_, url: str=_url_) -> dict:
        for pair in data:
            d = dictionary[pair[0]]
            d[name] = pair[0]
            d[url] = pair[1]

        return dictionary

    @staticmethod
    def update_dictionary(dictionary, row: tuple, added: set=None, removed: set=None) -> dict:
        for m in removed:
            dictionary.pop(m)

        for m in added:
            dictionary[m] = dict((c, '') for c in row)

        return dictionary

    @staticmethod
    def init_template(template, sheet, address: str=_address_):
        used = Book.used_range(template)
        sheet.range(address).value = used

    @staticmethod
    def used_range(sheet) -> tuple:
        return sheet.impl.xl.usedRange()

    @staticmethod
    def try_ole(cls_name: str, xls: str) -> xw.Book:
        app = xw.App(impl=App(
            xl=COMRetryObjectWrapper(Dispatch(cls_name))))
        return app.books(xls)

    @staticmethod
    def try_app(fn: str) -> xw.Book:
        xls = path.basename(fn)
        try:
            # Called from WPS later versions, for earlier version, it is 'et.Application'
            return Book.try_ole('Ket.Application', xls)
        except KeyError:
            pass

        try:
            # Called from Excel
            return Book.try_ole('Excel.Application', xls)
        except KeyError as e:
            log.exception(e)
            raise e
