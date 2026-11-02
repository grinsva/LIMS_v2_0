/**
 * Функция, реализующая команду "toggle"
 * 
 *     device - Устройство (Object)
 *     
 */
module.exports = function(device) {
    if (device.state) {
      device.off();
    } else {
      device.on();
    }
  }
