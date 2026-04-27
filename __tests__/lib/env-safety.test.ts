import fs from 'fs';
import path from 'path';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function listFiles(dir: string): string[] {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return [];

  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(relative);
    return [relative];
  });
}

describe('environment safety', () => {
  it('keeps real env files ignored while allowing examples', () => {
    const gitignore = read('.gitignore');

    expect(gitignore).toMatch(/^\.env\*/m);
    expect(gitignore).toMatch(/^!\.env\.local\.example/m);
  });

  it('does not expose database URLs through NEXT_PUBLIC variables in source', () => {
    const sourceFiles = listFiles('src').filter(file => /\.(ts|tsx)$/.test(file));
    const combinedSource = sourceFiles.map(read).join('\n');

    expect(combinedSource).not.toMatch(/NEXT_PUBLIC_.*DATABASE_URL/);
    expect(combinedSource).not.toMatch(/NEXT_PUBLIC_.*DIRECT_URL/);
  });

  it('keeps example and documentation database URLs as placeholders', () => {
    const publicDocs = ['.env.local.example', 'README.md']
      .filter(file => fs.existsSync(path.join(root, file)))
      .map(read)
      .join('\n');

    expect(publicDocs).not.toMatch(/npg_[A-Za-z0-9]+/);
    expect(publicDocs).not.toMatch(/neondb_owner:[^@\s]+@/);
    expect(publicDocs).not.toMatch(/ep-[a-z0-9-]+\.[a-z0-9-]+\.aws\.neon\.tech/i);
  });
});
