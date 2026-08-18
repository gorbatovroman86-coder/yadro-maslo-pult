#!/usr/bin/env python3
"""Безопасная правка текстовых файлов проекта.

Защита от аварии 18.08: пустой срез между заголовками превратил str.replace('')
во вставку текста между КАЖДЫМ символом, README раздулся со 30 КБ до 117 МБ
и был отклонён GitHub'ом уже после коммита.

Правила:
  * replace() отказывается работать с пустым образцом;
  * cut() проверяет порядок границ и не возвращает пустой срез;
  * write() откатывает файл, если он вырос больше чем вдвое или образец не найден.
"""
import io, os, shutil, sys

GROWTH_LIMIT = 2.0


class Doc:
    def __init__(self, path):
        self.path = path
        self.orig = io.open(path, encoding='utf-8').read()
        self.text = self.orig

    def replace(self, old, new, required=True):
        if not old:
            raise ValueError('пустой образец замены — именно так и раздуло README')
        if old not in self.text:
            if required:
                raise KeyError('образец не найден: %r' % old[:80])
            return self
        self.text = self.text.replace(old, new)
        return self

    def cut(self, start, end):
        """Срез между двумя маркерами с проверкой порядка."""
        a = self.text.find(start)
        b = self.text.find(end)
        if a < 0 or b < 0:
            raise KeyError('маркер не найден: %r / %r' % (start[:50], end[:50]))
        if b <= a:
            raise ValueError('маркеры идут в обратном порядке: %r после %r' % (end[:50], start[:50]))
        return self.text[a:b]

    def write(self):
        grow = len(self.text) / max(1, len(self.orig))
        if grow > GROWTH_LIMIT:
            raise RuntimeError('файл вырос в %.1f раза (%d -> %d) — правка отменена'
                               % (grow, len(self.orig), len(self.text)))
        backup = self.path + '.bak'
        shutil.copy2(self.path, backup)
        io.open(self.path, 'w', encoding='utf-8').write(self.text)
        after = os.path.getsize(self.path)
        if after > len(self.orig.encode('utf-8')) * GROWTH_LIMIT:
            shutil.copy2(backup, self.path)
            raise RuntimeError('после записи файл вырос сверх лимита — откат из %s' % backup)
        os.remove(backup)
        print('%s: %d -> %d символов (x%.2f)' % (self.path, len(self.orig), len(self.text), grow))
        return self
