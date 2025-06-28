import { ResourceHandler, ListOptions } from '../../../resource-handler';
import { PluginContext } from '../../../types';
import { DockerService } from '../services/docker-service';
import { Container } from '../types';

export class ContainerHandler extends ResourceHandler<Container> {
  protected resourceName = 'docker-container';
  private dockerService: DockerService;
  
  constructor(dockerService: DockerService) {
    super();
    this.dockerService = dockerService;
  }
  
  async list(context: PluginContext, options?: ListOptions): Promise<Container[]> {
    const containers = await this.dockerService.listContainers();
    return this.applyListOptions(containers, options);
  }
  
  async get(context: PluginContext, id: string): Promise<Container | null> {
    const containers = await this.dockerService.listContainers();
    return containers.find(c => c.id.startsWith(id) || c.name === id) || null;
  }
  
  // Optional methods - not implemented
  create = undefined;
  update = undefined;
  
  async delete(context: PluginContext, id: string): Promise<boolean> {
    try {
      await this.dockerService.removeContainer(id);
      return true;
    } catch (error) {
      return false;
    }
  }
}