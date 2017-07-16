import * as t from 'io-ts';
import { string, number, Integer as int, any } from 'io-ts';

const DateFromString: t.Type<Date> = {
  _A: t._A,
  name: 'DateFromString',
  validate: (v, c) =>
    t.string.validate(v, c).chain(s => {
      const d = new Date(s)
      return isNaN(d.getTime()) ? t.failure<Date>(s, c) : t.success(d)
    })
}

const DateToString: t.Type<string> = {
  _A: t._A,
  name: 'DateFromString',
  validate: (v, c) => {
    if (!(v instanceof Date)) return t.failure(v, c);
    if (isNaN(v.getTime())) return t.failure(v, c);
    return t.success(v.toJSON());
  }
}

const date = DateFromString;

export const FileStat = t.interface({
  dirname: string,
  filename: string,
  stat: t.interface({
    dev: int,
    mode: int,
    nlink: int,
    uid: int,
    gid: int,
    rdev: int,
    blksize: int,
    ino: int,
    size: int,
    blocks: int,
    atime: date,
    mtime: date,
    ctime: date,
    birthtime: date,
  })
});

export { string, number, int, any };

export type FileStat = t.TypeOf<typeof FileStat>;

export const ProcessOutput = t.union([
  t.interface({
    stream: t.literal("stdout"),
    text: string
  }),
  t.interface({
    stream: t.literal("stderr"),
    text: string
  })
])
export type ProcessOutput = t.TypeOf<typeof ProcessOutput>;