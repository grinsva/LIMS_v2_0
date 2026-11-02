
/**
 * Функция вывода значения "pump_cooling" в виде строки
 * 
 *     device - Устройство (Object)
 *     prop = "pump_cooling"
 *     val - исходное значение
 */
module.exports = function (device, prop, val) {
    return val == 1 ? 'Включен' : 'Выключен';
  }
