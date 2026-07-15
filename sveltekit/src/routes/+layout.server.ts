import { readFile } from 'node:fs/promises';
import type { LayoutServerLoad } from './$types';
import type { SiteConfig } from '$lib/types';

const configFile = new URL(
  '../../static/metadata/config.json',
  import.meta.url
);

export const load: LayoutServerLoad = async () => {
  const raw = await readFile(configFile, 'utf-8');
  const config = JSON.parse(raw) as SiteConfig;

  if (!config.site_url) {
    throw new Error(
      'Missing required site_url in generated metadata/config.json'
    );
  }

  if (!config.color) {
    throw new Error(
      'Missing required color in generated metadata/config.json'
    );
  }

  return { config };
};