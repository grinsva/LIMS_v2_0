
/**
 * Функция вычисления значения свойства "P0"
 * 
 *     device - Устройство (Object)
 *     
 */
module.exports = function(device) {
    const sum = device.P1+device.P2+device.P3;
    device.log('P1='+device.P1+' P2='+device.P2+' P3='+device.P3+ 'SUM='+sum)
   
    return sum;
  }
