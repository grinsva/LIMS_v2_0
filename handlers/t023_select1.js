/**
 * Функция, реализующая команду "select1"
 * 
 *     device - Устройство (Object)
 *     
 */
module.exports = function(device) {
     if (device.hasChannel('select1')) {
      device.writeChannel('select1');
    } else {
      device.setValue('state', 1);
    }
  }
