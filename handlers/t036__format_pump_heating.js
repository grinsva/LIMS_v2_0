
/**
 * Функция вывода значения "pump_heating" в виде строки
 * 
 *     device - Устройство (Object)
 *     prop = "pump_heating"
 *     val - исходное значение
 */
module.exports = function (device, prop, val) {
    return val == 1 ? 'Включен' : 'Выключен';
  }
