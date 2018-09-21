#! /usr/bin/python3
# -*- coding: utf-8 -*-

import requests

from config import request_url


s = requests.Session()
s.trust_env = False

s.put(request_url('bye'), timeout=5)
exit(0)
