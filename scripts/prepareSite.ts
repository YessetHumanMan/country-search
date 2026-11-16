import { cp, mkdir, rm } from 'node:fs/promises';

// Публикуем только статику; .git, исходники и зависимости не попадают на хостинг.
const output = new URL('../_site/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of ['index.html', 'styles.css', 'dist']) {
  await cp(new URL(`../${path}`, import.meta.url), new URL(path, output), {
    recursive: true,
  });
}
