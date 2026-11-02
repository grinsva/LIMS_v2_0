
/**
 * Функция вывода значения "state" в виде строки
 * 
 *     device - Устройство (Object)
 *     prop = "state"
 *     val - исходное значение
 */
module.exports = function (device, prop, val) {
    return val == 1 ? 'Задымление' : 'Норма';
  }
