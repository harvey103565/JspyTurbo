import re

from sklearn import svm
from unicodedata import east_asian_width as east_asian


_category_ = '类别'
_code_name_ = '代码'
_abbreviation_ = '缩写'
_title_ = '标题'


class VSClsfir(object):
    def __init__(self, data: list):
        """
        Create a AISeparator with training samples, this will initialize a SVM useful for separating the words
        :param data: Training samples
        """
        self._category_ = _category_
        self._code_name_ = _code_name_
        self._abbreviation_ = _abbreviation_

        self.data = data

        self.clf = None

    def train(self):
        samples = VSClsfir.samples_from(self.data)

        data = list()
        target = list()
        for sample in samples:
            phrases = VSClsfir.to_sections(sample[2])
            index = phrases.index(sample[0])
            vector = self.measure(sample[0], phrases, index)

            data.append(vector)

            target.append(sample[1])

        self.clf = svm.SVC(kernel='poly', decision_function_shape='ovo', probability=True)
        self.clf.fit(data, target)

    def classify(self, text: str):
        if not self.clf:
            raise AssertionError('使用未训练的分类器')

        phrases = VSClsfir.to_sections(text)
        result = dict()

        for phrase in phrases:
            index = phrases.index(phrase)
            vector = self.measure(phrase, phrases, index)

            key, prob = self.predict(list([vector]))

            if key not in result:
                result[key] = [(phrase, index)]
            else:
                result[key].append((phrase, index))

        return VSClsfir.assemble_title(result)

    def predict(self, vector: list) -> tuple:
        result = self.clf.predict(vector)
        probs = self.clf.predict_proba(vector)

        return result[0], 1 - min(probs[0])

    @staticmethod
    def assemble_title(results: dict) -> str:
        if '标题' not in results:
            raise ValueError('没有包含标题')

        words = results[_title_]
        words.sort(key=lambda w: w[1], reverse=True)

        i = 0
        phrases = list([[]])
        for word in words:
            j = word[1]
            if phrases[-1] and j != i - 1:
                phrases.append(list())

            phrases[-1].append(word[0])
            i = j

        phrases.sort(key=lambda x: len(x), reverse=True)

        return str.join('', phrases[0][-1::-1])

    @staticmethod
    def measure(phrase: str, phrases: tuple, index: int) -> list:
        t = sum(len(p) for p in phrases)

        m = len(phrases)
        n = len(phrase)
        dc = 100 if VSClsfir.count_digits(phrase) else 0
        ac = 100 if VSClsfir.count_alpha(phrase) else 0
        zc = 100 if VSClsfir.count_zh(phrase) else 0
        sc = 100 if n > (dc + ac + zc) else 0

        if index < m / 5:
            h = 0
        elif index < m / 3:
            h = 20
        elif index < m / 2:
            h = 80
        else:
            h = 100

        if n < t / 5:
            g = 0
        elif n < t / 3:
            g = 20
        elif n < t / 2:
            g = 80
        else:
            g = 100

        return [dc, ac, zc, sc, g, h]

    @staticmethod
    def count_digits(phrase: str) -> int:
        n = 0
        for c in phrase:
            if c.isdigit():
                n += 1
        return n

    @staticmethod
    def count_alpha(phrase: str) -> int:
        n = 0
        for c in phrase:
            try:
                if c.encode('ascii').isalpha():
                    n += 1
            except UnicodeEncodeError:
                continue
        return n

    @staticmethod
    def count_zh(phrase: str) -> int:
        n = 0
        for c in phrase:
            if east_asian(c) != 'Na':
                n += 1
        return n

    @staticmethod
    def to_sections(text):
        seps = (None, '_', ' ', '-', '.', ',', ';')
        return tuple(word for word in re.split(r'[- _]', text) if word and word not in seps)

    @staticmethod
    def samples_from(data: list) -> list:
        header = data[0]
        for row in data[1:]:
            i = 0
            for record in row[:-1]:
                if record:
                    for phrase in record.split(','):
                        yield (phrase, header[i], row[-1])
                i += 1
