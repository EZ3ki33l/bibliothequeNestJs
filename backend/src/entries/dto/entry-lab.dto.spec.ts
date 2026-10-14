import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EntryLabDto } from './entry-lab.dto';
import { UpdateEntryDto } from './update-entry.dto';

const PIPE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };

const lab = {
  tool: 'VAGRANT',
  securityLab: false,
  software: 'VirtualBox 7.1',
  ramGb: 4,
  diskGb: 10,
  hosts: ['LINUX', 'WINDOWS'],
  setupMd: '`vagrant up`',
  teardownMd: '`vagrant destroy -f`',
  files: { Vagrantfile: 'Vagrant.configure("2") do |c| end\n' },
};

function validateLab(body: Record<string, unknown>) {
  return validate(plainToInstance(EntryLabDto, { ...lab, ...body }), PIPE_OPTIONS);
}

describe('EntryLabDto', () => {
  it('accepts a complete lab', async () => {
    await expect(validateLab({})).resolves.toHaveLength(0);
  });

  it.each([
    ['unknown tool', { tool: 'CHEF' }],
    ['ram 0', { ramGb: 0 }],
    ['ram 129', { ramGb: 129 }],
    ['disk 501', { diskGb: 501 }],
    ['non-integer ram', { ramGb: 1.5 }],
    ['no host', { hosts: [] }],
    ['duplicated host', { hosts: ['LINUX', 'LINUX'] }],
    ['unknown host', { hosts: ['BSD'] }],
    ['software > 300', { software: 'x'.repeat(301) }],
    ['setup > 5000', { setupMd: 'x'.repeat(5001) }],
    ['teardown > 3000', { teardownMd: 'x'.repeat(3001) }],
    ['hostile path', { files: { '../x': 'y' } }],
    ['unknown field', { password: 'x' }],
  ])('refuses %s', async (_name, patch) => {
    expect((await validateLab(patch)).length).toBeGreaterThan(0);
  });

  it('accepts bounds', async () => {
    await expect(
      validateLab({ ramGb: 128, diskGb: 500, software: 'x'.repeat(300) }),
    ).resolves.toHaveLength(0);
  });

  it('is validated through the parent DTO, and null is accepted for removal', async () => {
    const bad = plainToInstance(UpdateEntryDto, { lab: { ...lab, files: { '../x': '' } } });
    expect((await validate(bad, PIPE_OPTIONS)).length).toBeGreaterThan(0);

    const none = plainToInstance(UpdateEntryDto, { lab: null });
    await expect(validate(none, PIPE_OPTIONS)).resolves.toHaveLength(0);
  });
});
