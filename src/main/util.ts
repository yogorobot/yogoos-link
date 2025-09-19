/* eslint import/prefer-default-export: off */
import { URL } from 'url';
import path from 'path';
import { extend } from 'lodash';

export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 1212;
   const url = new URL(`http://localhost:${port}`);
    url.pathname = `#/${htmlFileName}`;
    return url.href;
  }
  // 在生产环境中，HTML 文件位于 ../renderer/index.html
  const htmlPath = path.resolve(__dirname, '../renderer/index.html');
  return `file://${htmlPath}#/${htmlFileName}`.replace(/\\/g, '/');
}

export const tryTodo = <T, U = any>(
  promise: Promise<T>,
): Promise<[U | null, T | null]> => {
  return promise
    .then<[null, T]>((data: T) => [null, data])
    .catch<[U, null]>((err) => [err, null]);
};

export function encodeBase64<T>(data: T): string {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

export function decodeBase64<T>(data: string): T {
  return JSON.parse(Buffer.from(data, 'base64').toString('utf-8')) as T;
}

export class Response<T> {
  success: boolean;
  error: string | null;
  data: T | null;

  constructor(success: boolean, error: string | null, data: T | null) {
    this.success = success;
    this.error = error;
    this.data = data;
  }
}

export class ErrorResponse extends Response<null> {
  constructor(error: string | null) {
    super(false, error, null);
  }
}

export class SuccessResponse<T> extends Response<T> {
  constructor(data: T) {
    super(true, null, data);
  }
}
