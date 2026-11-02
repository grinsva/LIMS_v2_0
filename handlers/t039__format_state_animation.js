
/**
 * Функция вывода значения "state_animation" в виде строки
 * 
 *     device - Устройство (Object)
 *     prop = "state_animation"
 *     val - исходное значение
 */
module.exports = function (device, prop, val) {
    if (val == 0) return "Закрыто";
    if (val == 1) return "Открыто";  
    if (val == 2) return "Открывается";
    if (val == 3) return "Закрывается";      
  }