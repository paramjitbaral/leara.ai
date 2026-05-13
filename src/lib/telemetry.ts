export const telemetry = {
  log: (event: string, data?: any) => {
    try {
      const s = localStorage.getItem('leara-storage');
      if (s) {
        const parsed = JSON.parse(s);
        if (parsed?.state?.workspaceSettings?.telemetry) {
          console.log(`[Telemetry] ${event}`, data || '');
        }
      }
    } catch (e) {
      // Ignore
    }
  }
};
