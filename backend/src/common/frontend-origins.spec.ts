import { frontendOrigins } from './frontend-origins';

describe('frontendOrigins', () => {
  it('returns a single origin as a one-item list', () => {
    expect(frontendOrigins('http://localhost:5173')).toEqual(['http://localhost:5173']);
  });

  it('splits several comma-separated origins', () => {
    expect(frontendOrigins('http://localhost:5173,http://localhost:8081')).toEqual([
      'http://localhost:5173',
      'http://localhost:8081',
    ]);
  });

  it('trims spaces and drops empty entries', () => {
    expect(frontendOrigins(' http://localhost:5173 , ,http://localhost:8081, ')).toEqual([
      'http://localhost:5173',
      'http://localhost:8081',
    ]);
  });

  it('falls back to the default dev origin when unset or blank', () => {
    expect(frontendOrigins(undefined)).toEqual(['http://localhost:5173']);
    expect(frontendOrigins('  ')).toEqual(['http://localhost:5173']);
  });
});
