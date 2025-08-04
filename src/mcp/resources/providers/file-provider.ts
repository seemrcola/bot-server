/**
 * @file resources/providers/file-provider.ts
 * @description 文件资源提供者，用于加载本地文件
 */

import { IResourceProvider, ResourceURI } from '../../types/resources.types.js';
import { promises as fs } from 'fs';
import path from 'path';

export class FileProvider implements IResourceProvider {
  private readonly scheme = 'file://';
  private readonly root: string;

  constructor(root: string = process.cwd()) {
    this.root = root;
  }

  public canHandle(uri: ResourceURI): boolean {
    return uri.startsWith(this.scheme);
  }

  public async load(uri: ResourceURI): Promise<string> {
    const filePath = path.resolve(this.root, uri.substring(this.scheme.length));

    // 安全性检查：确保文件路径在根目录内
    if (!filePath.startsWith(this.root)) {
      throw new Error('File path is outside the allowed root directory.');
    }

    return fs.readFile(filePath, 'utf-8');
  }
}
