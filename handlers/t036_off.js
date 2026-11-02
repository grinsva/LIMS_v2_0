 
/**
 * Функция, реализующая команду "off"
 * 
 *     device - Устройство (Object)
 *     
 */
module.exports = function(device) {
    
    if (device.hasChannel('off')) {
      device.writeChannel('off');
    } else {
      device.setValue('state', 0);
    }
  }
