import { get, set, del, keys, clear } from 'idb-keyval';

/**
 * LocalStorage/IndexedDB based persistence layer.
 * This stores project data locally in the browser to avoid Firestore quota limits.
 */

export interface LocalFile {
  path: string;
  content: string;
  type: 'file' | 'directory';
  updatedAt: number;
}

export const localStore = {
  /**
   * Save a file to local IndexedDB
   */
  async saveFile(projectId: string, file: LocalFile) {
    const key = `project:${projectId}:file:${file.path}`;
    await set(key, file);

    // Also update a list of files for this project to make retrieval easier
    const fileListKey = `project:${projectId}:fileList`;
    const fileList: string[] = (await get(fileListKey)) || [];
    if (!fileList.includes(file.path)) {
      fileList.push(file.path);
      await set(fileListKey, fileList);
    }
  },

  /**
   * Batch save multiple files to IndexedDB
   */
  async saveFiles(projectId: string, files: LocalFile[]) {
    const fileListKey = `project:${projectId}:fileList`;
    const fileList: string[] = (await get(fileListKey)) || [];
    const fileListSet = new Set(fileList);
    let changed = false;

    // Use a loop to prevent launching 2459 concurrent promises at once which could crash the browser tab
    for (const file of files) {
      await set(`project:${projectId}:file:${file.path}`, file);
      if (!fileListSet.has(file.path)) {
        fileListSet.add(file.path);
        changed = true;
      }
    }

    if (changed) {
      await set(fileListKey, Array.from(fileListSet));
    }
  },

  /**
   * Get all files for a project from local storage
   */
  async getProjectFiles(projectId: string): Promise<LocalFile[]> {
    const fileListKey = `project:${projectId}:fileList`;
    const fileList: string[] = (await get(fileListKey)) || [];

    const files: LocalFile[] = [];
    for (const path of fileList) {
      const file = await get(`project:${projectId}:file:${path}`);
      if (file) files.push(file);
    }
    return files;
  },

  /**
   * Delete a file from local storage
   */
  async deleteFile(projectId: string, path: string) {
    const key = `project:${projectId}:file:${path}`;
    await del(key);

    const fileListKey = `project:${projectId}:fileList`;
    const fileList: string[] = (await get(fileListKey)) || [];
    const newList = fileList.filter(p => p !== path);
    await set(fileListKey, newList);
  },

  /**
   * Delete entire project from local storage
   */
  async deleteProject(projectId: string) {
    const fileListKey = `project:${projectId}:fileList`;
    const fileList: string[] = (await get(fileListKey)) || [];

    for (const path of fileList) {
      await del(`project:${projectId}:file:${path}`);
    }
    await del(fileListKey);
  }
};
