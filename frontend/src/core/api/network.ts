import * as LanHandler from '../../../wailsjs/go/handlers/LanHandler';
import * as CloudHandler from '../../../wailsjs/go/handlers/CloudHandler';

export const lan = {
    startServer: () => LanHandler.StartLanServer(),
    stopServer: () => LanHandler.StopLanServer(),
    getServerStatus: () => LanHandler.GetLanServerStatus(),
    connect: (ip: string, port: number = 0, secret: string = '') => LanHandler.ConnectToLanServer(ip, port, secret),
    disconnect: () => LanHandler.DisconnectFromLanServer(),
    getClientStatus: () => LanHandler.GetLanClientStatus(),
    getLocalIP: () => LanHandler.GetLocalIP(),
    discoverServers: () => LanHandler.DiscoverServers(),
    testConnection: () => LanHandler.TestLanConnection(),
    getConnectedClients: () => LanHandler.GetConnectedClients(),
    disconnectClient: (deviceId: string) => LanHandler.DisconnectLanClient(deviceId),
    suspendClient: (deviceId: string) => LanHandler.SuspendLanClient(deviceId),
    resumeClient: (deviceId: string) => LanHandler.ResumeLanClient(deviceId),
    blockDevice: (deviceId: string, deviceName: string, reason: string) =>
        LanHandler.BlockLanDevice(deviceId, deviceName, reason),
    getBlockedDevices: () => LanHandler.GetBlockedDevices(),
    unblockDevice: (id: number) => LanHandler.UnblockLanDevice(id),
};

export const drive = {
    initAuth: () => CloudHandler.InitGoogleAuth(),
    completeAuth: () => CloudHandler.CompleteGoogleAuth(),
    isConnected: () => CloudHandler.IsGoogleConnected(),
    disconnect: () => CloudHandler.DisconnectGoogle(),
    uploadBackup: (filename: string, content: string) => CloudHandler.UploadBackupToDrive(filename, content),
};
