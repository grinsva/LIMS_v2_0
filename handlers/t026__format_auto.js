
/**
 * Функция вывода значения "auto" в виде строки
 * 
 *     device - Устройство (Object)
 *     prop = "auto"
 *     val - исходное значение
 */
module.exports = function (device, prop, val) {
    return val == 1 ? 'Включен' : 'Выключен';
  }
