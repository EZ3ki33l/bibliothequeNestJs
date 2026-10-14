import type { Request, Response } from 'express';
import { payloadTooLargeHandler } from './payload-too-large';

describe('payloadTooLargeHandler', () => {
  const req = {} as Request;

  function makeRes() {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    return { res: { status } as unknown as Response, status, json };
  }

  it('answers 413 JSON in French for an oversized body', () => {
    const { res, status, json } = makeRes();
    const next = jest.fn();

    payloadTooLargeHandler({ type: 'entity.too.large' }, req, res, next);

    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith({
      statusCode: 413,
      message: 'La requête dépasse la taille admise.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('passes any other error along', () => {
    const { res, status } = makeRes();
    const next = jest.fn();
    const error = { type: 'entity.parse.failed' };

    payloadTooLargeHandler(error, req, res, next);

    expect(status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(error);
  });
});
