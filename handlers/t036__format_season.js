
/**
 * Функция вывода значения "season" в виде строки
 * 
 *     device - Устройство (Object)
 *     prop = "season"
 *     val - исходное значение
 */
module.exports = function (device, prop, val) {
    return val == 1 ? 'Зима' : 'Лето';
  }
