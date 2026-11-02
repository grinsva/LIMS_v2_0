 
/**
 * Функция, реализующая команду "on"
 * 
 *     device - Устройство (Object)
 *     
 */
module.exports = function(device) {
    
    if (device.hasChannel('on')) {
      device.writeChannel('on');
    } else {
      device.setValue('state', 1);
    }
  }
