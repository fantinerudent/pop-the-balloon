
window.addEventListener('DOMContentLoaded', () => {
    let ioSocket = io("localhost:8000");
    ioSocket.on("connect", () => {
        console.log('socket connectée.')
    })  
    ioSocket.on("room-created", (rooms) => {
        for (let i = 0; i < rooms.length; i ++) {
            let roomElement = document.createElement('div')
            roomElement.innerText = rooms[i]
            let roomLink = document.createElement('a')
            roomLink.href = `/${rooms[i]}`
            roomLink.innerText = 'join'
            roomContainer.append(roomElement)
            roomContainer.append(roomLink)
            ioSocket.emit("room-joigned", {socketId: ioSocket.id, rooms})
        }
    }) 

    const roomToJoin = document.querySelectorAll("href");
    for(let i=0; i<roomToJoin.length; i++) {
        roomToJoin[i].addEventListener('click', (event)=>{
            event.preventDefault();
            ioSocket.emit("room_to_remove", this)
        })
    }
})
