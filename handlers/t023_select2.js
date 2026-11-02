/**
 * Функция, реализующая команду "select2"
 * 
 *     device - Устройство (Object)
 *     
 */
module.exports = function(device) {
     if (device.hasChannel('select2')) {
      device.writeChannel('select2');
    } else {
      device.setValue('state', 2);
    }
  }
