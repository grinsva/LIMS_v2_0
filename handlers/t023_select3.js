/**
 * Функция, реализующая команду "select3"
 * 
 *     device - Устройство (Object)
 *     
 */
module.exports = function(device) {
     if (device.hasChannel('select3')) {
      device.writeChannel('select3');
    } else {
      device.setValue('state', 3);
    }
  }
  
