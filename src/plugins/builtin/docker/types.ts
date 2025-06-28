import { z } from 'zod';

// Container schema
export const ContainerSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  image: z.string().optional(),
  ports: z.string().optional(), // Keep as string for backwards compatibility
  created: z.string().optional()
});

export type Container = z.infer<typeof ContainerSchema>;

// Port mapping schema
export const PortMappingSchema = z.object({
  container: z.string(),
  name: z.string(),
  ports: z.array(z.object({
    container: z.string(),
    host: z.string(),
    protocol: z.string()
  }))
});

export type PortMapping = z.infer<typeof PortMappingSchema>;

// Network schema
export const NetworkSchema = z.object({
  id: z.string(),
  name: z.string(),
  driver: z.string(),
  scope: z.string().optional(),
  containers: z.array(z.string()).optional()
});

export type Network = z.infer<typeof NetworkSchema>;

// Docker info schema
export const DockerInfoSchema = z.object({
  version: z.string(),
  apiVersion: z.string().optional(),
  os: z.string().optional(),
  architecture: z.string().optional(),
  containers: z.object({
    total: z.number(),
    running: z.number(),
    stopped: z.number()
  }).optional(),
  images: z.number().optional()
});

export type DockerInfo = z.infer<typeof DockerInfoSchema>;

// Command schemas
export const ListContainersArgsSchema = z.object({
  _: z.array(z.string()),
  all: z.boolean().optional(),
  limit: z.number().optional()
});

export const GetContainerArgsSchema = z.object({
  _: z.array(z.string()).min(2, "Container name or ID required"),
  json: z.boolean().optional()
});

export const ShowLogsArgsSchema = z.object({
  _: z.array(z.string()).min(2, "Container name or ID required"),
  tail: z.union([z.number(), z.string()]).optional(),
  follow: z.boolean().optional(),
  timestamps: z.boolean().optional()
});