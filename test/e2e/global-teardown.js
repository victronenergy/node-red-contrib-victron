// test/e2e/global-teardown.js
module.exports = async () => {
  const nodeRedProcess = global.__NODE_RED_PROCESS__
  
  if (nodeRedProcess) {
    console.log('Stopping Node-RED...')
    nodeRedProcess.kill('SIGTERM')
    
    // Wait for graceful shutdown
    await new Promise((resolve) => {
      nodeRedProcess.on('exit', resolve)
      setTimeout(() => {
        nodeRedProcess.kill('SIGKILL')
        resolve()
      }, 5000)
    })
    
    console.log('Node-RED stopped')
  }
}
