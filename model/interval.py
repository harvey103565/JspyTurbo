#! /usr/bin/python3
# -*- coding: utf-8 -*-

import re


class Interval(object):

    def __init__(self, expr: str = '', _max_: int = 0, _to_: str = '-', _or_: str = ','):
        self._or_ = _or_
        self._to_ = _to_
        self._max_ = _max_
        self._items = set()

        if expr:
            self.decode(expr)

        self.expr = expr

    @property
    def items(self):
        return self._items

    def decode(self, expr: str):
        """
        load an interval object from expression, which is string format.

        :param expr: str
        :return: Interval
        """
        borders = self.from_expr(expr)
        self.flat_map(borders)

    def encode(self) -> str:
        """
        Serialization an Interval Object, convert remaining items in set
        :return:
        """
        self.to_expr()
        return self.expr

    def from_expr(self, expr) -> iter:
        """
        Decompose expression to sub-expressions. "[1 - 3, 5, 8 -]" to [['1', '3'], ['5'], ['8', '']
        :param expr: str, the expression string
        :return:
        """
        pattern = re.compile(r'\[(\d*)(?:[ -]+\d*)?(?:[, ]+\d+(?:[ -]+\d*)?)*\]')
        m = pattern.match(expr)
        if not m:
            raise Exception('Coding error: not all characters in \'{}\' are valid digits'.format(expr))

        if not m.group(1):
            return []

        formulas = expr[1: -1].split(self._or_)
        if len(formulas) == 0:
            raise Exception('Empty interval: \'{}\' do not contain data.'.format(expr))

        return [boarder.split(self._to_) for boarder in formulas]

    def to_expr(self):
        """
        Convert items set to interval expression.
        :return:
        """
        exprs = list()
        if not self.items:
            return '[]'

        for interval in self.union():
            if len(interval) == 1:
                exprs.append(str(interval[0]))
            else:
                exprs.append('{:d}-{:d}'.format(interval[0], interval[-1]))
        self.expr = '[{}]'.format(','.join(str(op_pair) for op_pair in exprs))

    def flat_map(self, borders: iter):
        """
        Apart all border (pair)s into piece of lists
        :param borders:
        :return:
        """
        for border in borders:
            sub_range = self.unfold(border)
            self._items = self._items.union(list(sub_range))

    def union(self) -> iter:
        """
        Put all border (pair)s into a list
        :return: a generator that generates all border (pair)s in form of list
        """
        return (interval for interval in self.fold())

    def unfold(self, border: list) -> range:
        """
        Unfold border (pair) to a range. ['1', '3'] to {1, 2, 3}, ['5'] to {5} and ['8', ''] to {8, 9, ..., 'max'}
        :param border: a list that contains lower and/or upper border of an interval
        :return: Range object that represents the set of items in interval
        """
        left_border = int(border[0])
        if len(border) == 1:
            return range(left_border, left_border + 1)

        if border[-1] == '':
            if self._max_ == -1:
                right_border = left_border + 1
            else:
                right_border = self._max_ + 1
        elif int(border[-1]) > self._max_:
            right_border = self._max_ + 1
        else:
            right_border = int(border[-1]) + 1

        return range(left_border, right_border)

    def fold(self) -> tuple:
        """
        Fold item set into intervals
        :return: Generator that generates interval lists
        """
        items = list(self._items)
        items.sort()

        l_border = items[0]
        r_border = items[0]
        for i in range(1, len(items)):
            if items[i] > r_border + 1:
                yield l_border, r_border
                l_border = items[i]
            elif items[i] < r_border + 1:
                continue
            r_border += 1
        else:
            yield l_border, r_border

    def add(self, item: int):
        """
        Add an item into the set of items
        :param item: the item to add into the the set
        :return:
        """
        self._items |= item

    def remove(self, item: int):
        """
        Remove an item out of the set
        :param item: the item to remove from the set
        :return:
        """
        self._items.remove(item)

    def __contains__(self, item):
        """
        If an item is contained in the interval sets
        :param item: the item to
        :return:
        """
        return item in self._items

    def __iter__(self):
        """
        The interval object is iterable so caller function do not need to access its raw data
        :return: get generator which traverse the set of items
        """
        return (item for item in self.items)

    def __len__(self):
        """
        The count of items
        :return: count value
        """
        return len(self.items)


