#! /usr/bin/python3
# -*- coding:utf-8 -*-


Protocol = 'Http'
Host = '127.0.0.1'
Port = '8086'


def request_url(http_method):
    return '{}://{}:{}/{}'.format(Protocol, Host, Port, http_method)
