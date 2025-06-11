import * as fs from 'fs';
import * as path from 'path';

/**
 * Loads a fixture file from the plugin's test fixtures directory
 * 
 * @param pluginPath - The path to the plugin directory
 * @param fixtureName - The name of the fixture file (without extension)
 * @returns The parsed fixture data
 * 
 * @example
 * const dockerResponses = await loadFixture(
 *   '/src/plugins/builtin/docker',
 *   'docker-responses'
 * );
 */
export async function loadFixture<T = any>(
  pluginPath: string,
  fixtureName: string
): Promise<T> {
  const fixturesDir = path.join(pluginPath, 'tests', 'fixtures');
  const fixturePath = path.join(fixturesDir, `${fixtureName}.json`);
  
  try {
    const content = await fs.promises.readFile(fixturePath, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Fixture not found: ${fixturePath}`);
    }
    throw new Error(`Failed to load fixture ${fixtureName}: ${error.message}`);
  }
}

/**
 * Synchronously loads a fixture file
 */
export function loadFixtureSync<T = any>(
  pluginPath: string,
  fixtureName: string
): T {
  const fixturesDir = path.join(pluginPath, 'tests', 'fixtures');
  const fixturePath = path.join(fixturesDir, `${fixtureName}.json`);
  
  try {
    const content = fs.readFileSync(fixturePath, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Fixture not found: ${fixturePath}`);
    }
    throw new Error(`Failed to load fixture ${fixtureName}: ${error.message}`);
  }
}

/**
 * Common fixture data that plugins can use
 */
export const commonFixtures = {
  // Docker container formats
  dockerContainerFormat: '{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}|{{.Ports}}|{{.CreatedAt}}',
  dockerNetworkFormat: '{{.ID}}|{{.Name}}|{{.Driver}}|{{.Scope}}',
  
  // Sample container data
  sampleContainers: [
    {
      id: 'abc123456789',
      name: 'web-app',
      status: 'Up 2 hours',
      image: 'nginx:latest',
      ports: '0.0.0.0:80->80/tcp',
      created: '2024-01-01 12:00:00 +0000 UTC'
    },
    {
      id: 'def123456789',
      name: 'api-server',
      status: 'Up 1 hour',
      image: 'node:18',
      ports: '0.0.0.0:3000->3000/tcp',
      created: '2024-01-01 13:00:00 +0000 UTC'
    },
    {
      id: 'ghi123456789',
      name: 'database',
      status: 'Exited (0) 3 hours ago',
      image: 'postgres:15',
      ports: '',
      created: '2024-01-01 10:00:00 +0000 UTC'
    }
  ],
  
  // Format container data for mock responses
  formatContainers: (containers: any[]) => {
    return containers.map(c => 
      `${c.id}|${c.name}|${c.status}|${c.image}|${c.ports}|${c.created}`
    ).join('\n');
  }
};