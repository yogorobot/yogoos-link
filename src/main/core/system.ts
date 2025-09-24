import { sshManager } from '../managers';

class System {
  async reboot() {
    return await sshManager.executeCommand('sudo reboot');
  }
}

export default System;
