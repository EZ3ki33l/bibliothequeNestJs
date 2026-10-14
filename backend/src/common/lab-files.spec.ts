import {
  labFilesRefusal,
  labPathRefusal,
  MAX_LAB_FILE_LENGTH,
  MAX_LAB_FILES,
  MAX_LAB_PATH_LENGTH,
  MAX_LAB_TOTAL_LENGTH,
} from './lab-files';

describe('labPathRefusal', () => {
  it.each([
    '../../.bashrc',
    '..',
    '../x',
    'a/../b',
    '/etc/passwd',
    'C:\\Windows\\x',
    'C:/x',
    'a\\b',
    'a//b',
    './x',
    'a/./b',
    'nul',
    'CON.txt',
    'a/com1.sh',
    '.bashrc',
    '.ssh/id_rsa',
    'a/b/c/d/e/f.sh',
    'file.',
    'x\u0000y',
    'accentué.sh',
    'a b.sh',
    'x\u202Egpj.sh',
    '',
    'a'.repeat(MAX_LAB_PATH_LENGTH + 1),
    `${'a'.repeat(65)}.sh`,
  ])('refuses %j', (path) => {
    expect(labPathRefusal(path)).not.toBeNull();
  });

  it.each(['Vagrantfile', 'provision/serveur.sh', '.env.example', 'a/b/c/d/e.yml'])(
    'accepts %j',
    (path) => {
      expect(labPathRefusal(path)).toBeNull();
    },
  );
});

describe('labFilesRefusal', () => {
  it('accepts a small lab', () => {
    expect(labFilesRefusal({ Vagrantfile: 'x', 'a/b.sh': 'y' })).toBeNull();
  });

  it('names the file in the message', () => {
    expect(labFilesRefusal({ '../x': 'y' })).toMatch(/^Fichier « \.\.\/x » : /);
  });

  it('refuses a non-object', () => {
    expect(labFilesRefusal([])).not.toBeNull();
    expect(labFilesRefusal(null)).not.toBeNull();
    expect(labFilesRefusal('x')).not.toBeNull();
  });

  it('refuses a non-text value', () => {
    expect(labFilesRefusal({ a: 1 })).not.toBeNull();
  });

  it('bounds the number of files', () => {
    const make = (n: number) =>
      Object.fromEntries(Array.from({ length: n }, (_, i) => [`f${i}`, '']));
    expect(labFilesRefusal(make(MAX_LAB_FILES))).toBeNull();
    expect(labFilesRefusal(make(MAX_LAB_FILES + 1))).not.toBeNull();
  });

  it('bounds one file and the total', () => {
    expect(labFilesRefusal({ a: 'x'.repeat(MAX_LAB_FILE_LENGTH) })).toBeNull();
    expect(labFilesRefusal({ a: 'x'.repeat(MAX_LAB_FILE_LENGTH + 1) })).not.toBeNull();

    const files = Object.fromEntries(
      Array.from({ length: 5 }, (_, i) => [`f${i}`, 'x'.repeat(MAX_LAB_TOTAL_LENGTH / 4)]),
    );
    expect(labFilesRefusal(files)).not.toBeNull();
  });

  it('refuses a null character', () => {
    expect(labFilesRefusal({ a: 'x\u0000' })).not.toBeNull();
  });

  it('refuses names equal up to case', () => {
    expect(labFilesRefusal({ 'Setup.sh': '', 'setup.sh': '' })).not.toBeNull();
  });

  it('refuses a file that is also a folder', () => {
    expect(labFilesRefusal({ a: '', 'a/b.sh': '' })).not.toBeNull();
  });
});
