
/**
 * Функция вычисления значения свойства "state"
 * 
 *     device - Устройство (Object)
 *     
 */
module.exports = function(device) {
    if (device.value > device.setpoint_hh) return 2;    
    if (device.value < device.setpoint_ll) return -2;
    if (device.value > device.setpoint_h) return 1;
    if (device.value < device.setpoint_l) return -1;
    return 0;
  }
