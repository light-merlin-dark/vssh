import { SSHService } from '../../../../services/ssh';

export interface Container {
  id: string;
  name: string;
  status: string;
  image: string;
  ports?: string;
  created?: string;
}

export interface Network {
  id: string;
  name: string;
  driver: string;
  scope: string;
}

export interface DockerStats {
  containers: {
    running: number;
    stopped: number;
    total: number;
  };
  images: number;
  volumes: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class DockerService {
  private ssh: SSHService;
  private containerCache?: CacheEntry<Container[]>;
  private networkCache?: CacheEntry<Network[]>;
  private readonly cacheTTL = 10000; // 10 seconds
  
  constructor(ssh: SSHService) {
    this.ssh = ssh;
  }
  
  async listContainers(useCache = true): Promise<Container[]> {
    if (useCache && this.containerCache) {
      const age = Date.now() - this.containerCache.timestamp;
      if (age < this.cacheTTL) {
        return this.containerCache.data;
      }
    }
    
    const output = await this.ssh.executeCommand(
      'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}|{{.Ports}}|{{.CreatedAt}}"'
    );
    
    const containers = output
      .trim()
      .split('\n')
      .filter(line => line)
      .map(line => {
        const [id, name, status, image, ports, created] = line.split('|');
        return { id, name, status, image, ports, created };
      });
    
    this.containerCache = {
      data: containers,
      timestamp: Date.now()
    };
    
    return containers;
  }
  
  async findContainersByPrefix(prefix: string): Promise<Container[]> {
    const containers = await this.listContainers();
    return containers.filter(c => 
      c.name.toLowerCase().startsWith(prefix.toLowerCase())
    );
  }
  
  async containerExists(containerIdOrName: string): Promise<boolean> {
    try {
      await this.ssh.executeCommand(`docker inspect ${containerIdOrName}`);
      return true;
    } catch {
      return false;
    }
  }
  
  async findContainers(
    searchTerm: string, 
    matchType: 'contains' | 'startsWith' | 'endsWith' = 'contains'
  ): Promise<Container[]> {
    const containers = await this.listContainers();
    const term = searchTerm.toLowerCase();
    
    return containers.filter(c => {
      const name = c.name.toLowerCase();
      switch (matchType) {
        case 'startsWith':
          return name.startsWith(term);
        case 'endsWith':
          return name.endsWith(term);
        default:
          return name.includes(term);
      }
    });
  }
  
  async getContainerLogs(container: string, tail?: number): Promise<string> {
    const tailFlag = tail ? `--tail ${tail}` : '';
    return await this.ssh.executeCommand(`docker logs ${tailFlag} ${container}`);
  }
  
  async listNetworks(useCache = true): Promise<Network[]> {
    if (useCache && this.networkCache) {
      const age = Date.now() - this.networkCache.timestamp;
      if (age < this.cacheTTL) {
        return this.networkCache.data;
      }
    }
    
    const output = await this.ssh.executeCommand(
      'docker network ls --format "{{.ID}}|{{.Name}}|{{.Driver}}|{{.Scope}}"'
    );
    
    const networks = output
      .trim()
      .split('\n')
      .filter(line => line)
      .map(line => {
        const [id, name, driver, scope] = line.split('|');
        return { id, name, driver, scope };
      });
    
    this.networkCache = {
      data: networks,
      timestamp: Date.now()
    };
    
    return networks;
  }
  
  async getSystemInfo(): Promise<any> {
    const output = await this.ssh.executeCommand('docker system info --format json');
    return JSON.parse(output);
  }
  
  async getDockerStats(): Promise<DockerStats> {
    const containers = await this.listContainers();
    const running = containers.filter(c => c.status.startsWith('Up')).length;
    const stopped = containers.length - running;
    
    // Get image count
    const imageOutput = await this.ssh.executeCommand('docker images -q | wc -l');
    const images = parseInt(imageOutput.trim());
    
    // Get volume count
    const volumeOutput = await this.ssh.executeCommand('docker volume ls -q | wc -l');
    const volumes = parseInt(volumeOutput.trim());
    
    return {
      containers: {
        running,
        stopped,
        total: containers.length
      },
      images,
      volumes
    };
  }
  
  async getContainerPorts(containerIdOrName: string): Promise<string> {
    const output = await this.ssh.executeCommand(
      `docker inspect ${containerIdOrName} --format '{{range $p, $conf := .NetworkSettings.Ports}}{{$p}} -> {{(index $conf 0).HostPort}}{{end}}'`
    );
    return output.trim();
  }
  
  async getTopContainers(limit = 5): Promise<string> {
    return await this.ssh.executeCommand(
      `docker stats --no-stream --format "table {{.Container}}\t{{.Name}}\t{{.CPU}}\t{{.MemUsage}}" | head -n ${limit + 1}`
    );
  }
}