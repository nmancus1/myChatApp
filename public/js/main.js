import {initializeApp} from 'https://www.gstatic.com/firebasejs/9.0.1/firebase-app.js';
import {
    getDatabase,
    onChildAdded,
    onChildChanged,
    onValue,
    push,
    ref,
    remove,
    set
} from 'https://www.gstatic.com/firebasejs/9.0.1/firebase-database.js';
// import version must be 9.0.1
import * as fbauth from "https://www.gstatic.com/firebasejs/9.0.1/firebase-auth.js";
/* Inspired by https://firebase.google.com/docs */
import * as htmlGenerator from "./htmlGenerator.js";
import {createOtherUserHTML} from "./htmlGenerator.js";

const firebaseConfig = {
    apiKey: "AIzaSyAdpaGbpdvZFS_J5BAPLVZxVW_vUlUVzbk",
    authDomain: "chat-app-233ed.firebaseapp.com",
    databaseURL: "https://chat-app-233ed-default-rtdb.firebaseio.com",
    projectId: "chat-app-233ed",
    storageBucket: "chat-app-233ed.appspot.com",
    messagingSenderId: "164333713364",
    appId: "1:164333713364:web:30280ad323df5e5c6a4841",
    measurementId: "G-HSB29G8SYD"
};

const app = initializeApp(firebaseConfig);

const db = getDatabase();
const authorize = fbauth.getAuth(app);
console.log(authorize);
let channelName = "general";
let isAdmin = false;
let serverName = "main";

let user;

function getTime() {
    const date = new Date();
    return (date.getMonth() + 1) + "/"
        + date.getDate() + "/"
        + date.getFullYear() + " @ "
        + date.getHours() + ":"
        + date.getMinutes() + ":"
        + date.getSeconds();
}


function sendMessage(text) {

    let message = {
        "history" : { },
        "msg" : text,
        "ownerID" : user.uid,
        "reactions" : "",
        "time" : Date.now(),
        "userDisplay" : user.displayName,
        "userPhotoURL": user.photoURL,
        "edited": "false"
    };
    const newMessageRef = push(ref(db, "servers/" + serverName + "/channels/" + channelName));
    set(newMessageRef, message);
    clearInputBox();
}

function getInputText() {
    const inputBox = document.getElementById("inputBox");
    return inputBox.value;
}

function clearInputBox() {
    const inputBox = document.getElementById("inputBox");
    inputBox.value = "";
    // TODO: clear input box
}

function addMessage(data) {
    const messageList = document.getElementById("messageList");
    const { history, msg, ownerID, reactions, time, userDisplay, userPhotoURL, edited } = data.val();
    const msgID = data.key;

    if (ownerID === user.uid) {
        // add pencil and x

        let timeWithPossibleEdited = timeConverter(time);
        if (edited === 'true') {
            timeWithPossibleEdited  += " * edited";
        }

        messageList.insertAdjacentHTML('beforeend',
            htmlGenerator.createMessageHTMLMyMessage(
                userPhotoURL, msg, userDisplay, timeWithPossibleEdited, msgID
            ));

        const messageEditButtonRef = $("#" + msgID + "_edit");
        messageEditButtonRef.on("click", e => {
            e.preventDefault();
            const existingMessageText =  $("#" + msgID + "_message_text");
            $("#" + msgID + "_messages")
                .append(htmlGenerator.createEditBoxHTML(msgID, existingMessageText[0].innerText));
            existingMessageText.hide();
            $(document).on('keyup', function (e) {
                e.preventDefault();
                editMessage(e, msgID);
            });
        });

        const deleteButtonRef = $("#" + msgID + "_delete");
        deleteButtonRef.on("click", e => {
            e.preventDefault();
            alert("Are you sure you want to delete this message?");
            remove(ref(db, "channels/" + channelName + "/" + msgID));
            $("#" + msgID + "_message").remove();
        });
    }
    else if (isAdmin) {
        // is admin, add x
        let timeWithPossibleEdited = timeConverter(time);
        if (edited === 'true') {
            timeWithPossibleEdited  += " * edited";
        }
        messageList.insertAdjacentHTML('beforeend',
            htmlGenerator.createMessageHTMLAdminMessage(
                userPhotoURL, msg, userDisplay, timeWithPossibleEdited, msgID
            ));

        const adminDeleteButtonRef = $("#" + msgID + "_delete");
        adminDeleteButtonRef.on("click", e => {
            if (isAdmin) {
                e.preventDefault();
                alert("Are you sure you want to delete this message?");
                remove(ref(db, "servers/" + serverName + "/channels/" + channelName + "/" + msgID))
                    .then($("#" + msgID + "_message").remove())
                    .catch(e => {
                        console.log(e);
                    });
            }
        });

    }
    else {
        // normal user and not my message
        let timeWithPossibleEdited = timeConverter(time);
        if (edited === 'true') {
            timeWithPossibleEdited  += " * edited";
        }
        messageList.insertAdjacentHTML('beforeend',
            htmlGenerator.createMessageHTML(userPhotoURL, msg, userDisplay, timeWithPossibleEdited));
    }

    messageList.scrollTop = messageList.scrollHeight;
}

function editMessage(e, msgID) {
    const currentChannelAndMessagePath = "/servers/" + serverName + "/channels/" + channelName + "/" + msgID;
    const editBoxRef = $("#" + msgID + "_editBox");
    if (e.key === "Enter") {
        set(ref(db, currentChannelAndMessagePath + "/msg"), editBoxRef.val());
        set(ref(db, currentChannelAndMessagePath + "/edited"), "true");
        set(ref(db, currentChannelAndMessagePath + "/time"), Date.now());
        editBoxRef.hide();
        $("#"+ msgID + "_message_text").show();
    }
    if (e.key === "Escape") {
        editBoxRef.hide();
        $("#"+ msgID + "_message_text").show();
    }
}


function addChannel(channel) {
    const channelList = document.getElementById("channelsGoHere");
    if (!$("#" + channel.key).length) {
        channelList.insertAdjacentHTML('beforeend',
            htmlGenerator.createChannelHTML(channel.key));
        //set up link for indv channel
        $("#" + channel.key).on("click", ev => {
            ev.preventDefault();
            console.log("clicked channel name...");
            channelName = channel.key;
            tearDown();
            init(user, channel.key, authorize);
        });
    }

}

function addServer(server) {
    const serverList = document.getElementById("serversGoHere");
    if (!$("#" + server.key).length) {
        serverList.insertAdjacentHTML('beforeend',
            htmlGenerator.createServerHTML(server.key));

        //set up link for indv server
        $("#" + server.key).on("click", ev => {
            ev.preventDefault();
            serverName = server.key;
            tearDown();
            channelName = "general";
            init(user, "general", authorize);
        });
    }
}

function addUser(data) {
    const {admin, displayName, online, role, photoURL} = data.val();

    const userList = document.getElementById("users-list");
    if (!$("#" + displayName).length) {
        userList.insertAdjacentHTML('beforeend',
            htmlGenerator.createOtherUserHTML(displayName, photoURL, online));
    }
}

// setup listeners
document.getElementById("send-button")
    .addEventListener("click", e => {
        const text = getInputText();
        if (text !== "") {
            sendMessage(text);
        }
    });

document.getElementById("forgotten-form")
    .addEventListener("submit", e => {
        e.preventDefault();
        let form = $("#forgotten-form");
        let input = form.serializeArray();
        form[0].reset();
        console.log(input[0].value);
        handlePasswordReset(input[0].value);
    });

function handlePasswordReset(emailAddress) {
    console.log('send me an email son');
    fbauth.sendPasswordResetEmail(authorize, emailAddress)
        .then(() => {
            alert("Recovery email sent!");
        })
        .catch((error) => {
            console.log(error.code);
            console.log(error.message);
        });
}

document.getElementById("loginWithGoogle")
    .addEventListener("click", e => {
        loginWithGoogle();
    });

document.getElementById("login-form")
    .addEventListener("submit", e => {
        e.preventDefault();
        let input = $("#login-form").serializeArray();
        loginWithEmailAndPassword(input[0].value, input[1].value);
    });

document.getElementById("register-form")
    .addEventListener("submit", e => {
        e.preventDefault();
        let input = $("#register-form").serializeArray();
        register(input[0].value, input[1].value, input[2].value, input[3].value);
        for (let i = 0; i < 4; i++) {
            input[i].reset();
        }
    });

function loginWithEmailAndPassword(email, password) {
    fbauth.signInWithEmailAndPassword(authorize, email, password)
        .then(data => handleOAuth(data))
        .catch(function (error) {
            console.log(error.code);
            console.log(error.message);
        });
}

function loginWithGoogle() {
    let provider = new fbauth.GoogleAuthProvider();
    fbauth.signInWithPopup(authorize, provider)
        .then(data => handleOAuth(data))
        .catch(error => {
            console.log(error.code);
            console.log(error.message);
    });
}

function handleOAuth(data) {
    user = data.user;
    onValue(ref(db, "servers/" + serverName + "/users/" + user.auth.lastNotifiedUid), snapshot => {
        if (snapshot.exists()) {
            // user exists in db
            set(ref(db, "servers/" + serverName + "/users/"
                + user.auth.lastNotifiedUid + "/online"), true);
        }
        else {
            // user doesn't exist in db
            let JSONString = JSON.stringify({
                "displayName" : "",
                "role" : "",
                "admin" : "false",
                "online" : true,
                "photoURL" : "//gravatar.com/avatar/56234674574535734573000000000001?d=retro"
            });
            let newUserJSON = JSON.parse(JSONString);
            newUserJSON.displayName = user.displayName;
            newUserJSON.photoURL = user.photoURL;
            set(ref(db, "servers/" + serverName + "/users/"
                + user.auth.lastNotifiedUid), newUserJSON);
        }
    });

}

function register(register_email, register_password, retype_password, displayName) {
    if (register_password === retype_password) {
        fbauth.createUserWithEmailAndPassword(
            authorize, register_email, register_password
        )
            .then(data => {
                console.log("here in register");
                user = data.user;
                console.log(user);
                if (authorize.currentUser !== null) {
                    fbauth.updateProfile(authorize.currentUser, {
                        displayName: displayName,
                        photoURL: "//gravatar.com/avatar/56234674574535734573000000000001?d=retro"
                    });
                    console.log(user.auth.lastNotifiedUid);

                    let JSONString = JSON.stringify({
                        "displayName" : "",
                        "role" : "",
                        "admin" : "false",
                        "online" : true,
                        "photoURL" : "//gravatar.com/avatar/56234674574535734573000000000001?d=retro"
                    });
                    let newUserJSON = JSON.parse(JSONString);
                    newUserJSON.displayName = displayName;
                    console.log("displayName");
                    console.log(displayName);
                    isAdmin = false;
                    set(ref(db, "servers/" + serverName + "/users/" + user.auth.lastNotifiedUid), newUserJSON);

                }
            })
            .catch(error => {
                console.log(error.code);
                console.log(error.message);
            });

    }
    else {
        alert("Passwords do not match!");
        // TODO: clear password inputs?
    }

}

fbauth.onAuthStateChanged(authorize, userInfo => {
    if (!!userInfo) {
        //check user role
        onValue(ref(db, "servers/" + serverName + "/users/" + authorize.currentUser.uid),
            ss => {
            if (ss.val() != null) {
                const {admin, displayName, online, role, photoURL} = ss.val();
                console.log("checking admin");
                console.log(admin);
                isAdmin = !!admin;

                init(userInfo, channelName, authorize);
                user = userInfo;
            }
            else {
                console.log("ss is null dude");
            }

            });


    } else {
        tearDown();
    }
});

function tearDown() {
    $("#auth-container").removeClass("d-none");
    $("#chat").addClass("d-none");
    $("#current-user-info").empty();
    $("#users-list").empty();
    $("#channelName").text("");
    $("#serverName").text("");
    $("#messageList").empty();
    $("#channelsGoHere").empty();
}

function init(user, channelName, authorize) {

    $("#chat").removeClass("d-none");
    $("#auth-container").addClass("d-none");
    if ($("#current-" + user.displayName) != null) {
        $("#current-user-info").append(htmlGenerator.createCurrentUserHTML(user));
        $("#currentUserActions").on("click", e => {
            const dropUpContent = $("#dropUpContent");

            if (dropUpContent.hasClass("d-none")) {
                dropUpContent.removeClass("d-none");
            }
            else {
                dropUpContent.addClass("d-none");
            }

        });
    }
    $("#channelName").text("#" + channelName);
    $("#serverName").text("server name: " + serverName);

    // add event listener for channels list
    onChildAdded(ref(db, "servers/" + serverName + "/channels/"), channel => addChannel(channel));

    // add event listener for servers list
    onChildAdded(ref(db, "servers/"), server => addServer(server));

    // add event listener for messages in current channel
    onChildAdded(ref(db, "servers/" + serverName + "/channels/" + channelName), data => addMessage(data));

    // add event listener for users in current server
    onChildAdded(ref(db, "servers/" + serverName + "/users/"), data => addUser(data));

    // watch for login status
    onChildChanged(ref(db, "servers/" + serverName + "/users/"),  data => {
        const {admin, displayName, online, role, photoURL} = data.val();
        $("#" + displayName).remove();
        addUser(data);
    });

    onChildChanged(ref(db, "servers/" + serverName + "/channels/" + channelName), data => {
        const { history, msg, ownerID, reactions,
            time, userDisplay, userPhotoURL, edited } = data.val();

        $("#" + data.key + "_posttime").html(timeConverter(time) + " * edited");
        $("#" + data.key + "_message_text").html(msg);
    })

    // Set up drop up user menu
    $("#logout").on("click", e => {
        // set user to offline
        e.preventDefault();
        console.log(authorize.currentUser.uid);
        const uuid = authorize.currentUser.uid;
        console.log("servers/" + serverName + "/users/" + uuid + "/online");
        set(ref(db, "servers/" + serverName + "/users/" + uuid + "/online"), false)
            .then(
                fbauth.signOut(authorize)
                    .then(function() {
                        console.log("log out successful");
                    }, function(error) {
                        console.log(error);
                    })
            ).catch(err => {
                console.log(err);
        });

    })
    $("#changePassword").on("click", e => {
        alert("doesn't work yet!");
    });
    $("#changeDisplayName").on("click", e => {
        alert("doesn't work yet!");
    });

    $("#addServerButton").on("click", e => {
        e.preventDefault();
        document.getElementById("newServerFormDiv")
            .insertAdjacentHTML("beforebegin", `
                <form action="" id="newServerForm">
                  <input id="newServerName" style="font-size: 10pt;" 
                        type="text" placeholder="Enter new server name">
                  <input type="submit">
                  <button type="button" id="serverCancelButton">Cancel</button>
                </form>
            `);
        $("#serverCancelButton").click(function() {
            $("#newServerForm").remove();
        });
        $("#newServerForm").submit(e => {
            e.preventDefault();
            console.log("here");
            const addServerBoxRef = $("#newServerName");
            let newServerName = addServerBoxRef.val();
            console.log("new server name");
            console.log(newServerName);
            $("#newServerForm").remove();

            let message = {
                "history" : { },
                "msg" : `Welcome to the #general channel!`,
                "ownerID" : "new-channel-bot",
                "reactions" : "",
                "time" : Date.now(),
                "userDisplay" : "new-channel-bot",
                "userPhotoURL": "https://gravatar.com/avatar/e6be0c37c31d874bdf1ed8496ec1f8d9?s=400&d=robohash&r=x",
                "edited": "false"
            };

            const newChannelRef = push(ref(db, "servers/" + newServerName + "/channels/general"));
            set(newChannelRef, message);

            // push new user, if you made a new server, you are admin
            let userJSON = {
                "admin": true,
                "displayName": user.displayName,
                "online" : true,
                "role" : "",
                "photoURL" : user.photoURL
            };

            const newUsersRef = push(ref(db, "servers/" + newServerName + "/users"));
            set(newUsersRef, userJSON).then(function () {
                serverName = newServerName;
                channelName = "general";
                tearDown();
                init(user, channelName, authorize);
            });
        })
    })

    $("#addChannelButton").on("click", e => {
        e.preventDefault();
        document.getElementById("newChannelFormDiv")
            .insertAdjacentHTML("beforebegin", `
                <form action="" id="newChannelForm">
                  <input id="newChannelName" style="font-size: 10pt;" 
                        type="text" placeholder="Enter new channel name">
                  <input type="submit">
                  <button type="button" id="channelCancelButton">Cancel</button>
                </form>
            `);
        $("#channelCancelButton").click(function() {
            $("#newChannelForm").remove();
        });
        $("#newChannelForm").submit(e => {
            e.preventDefault();
            const addChannelBoxRef = $("#newChannelName");
            let newChannelName = addChannelBoxRef.val();
            $("#newChannelForm").remove();

            let message = {
                "history" : { },
                "msg" : `Welcome to the ${newChannelName} channel!`,
                "ownerID" : "new-channel-bot",
                "reactions" : "",
                "time" : Date.now(),
                "userDisplay" : "new-channel-bot",
                "userPhotoURL": "https://gravatar.com/avatar/e6be0c37c31d874bdf1ed8496ec1f8d9?s=400&d=robohash&r=x",
                "edited": "false"
            };
            console.log("servers/" + serverName + "/channels")

            const newChannelRef = push(ref(db, "servers/" + serverName + "/channels/" + newChannelName));
            set(newChannelRef, message).then(function(){
                console.log("then!");
                channelName = newChannelName;
                tearDown();
                init(user, channelName, authorize);
            });

        })
    })
}

// stolen from https://stackoverflow.com/questions/847185/convert-a-unix-timestamp-to-time-in-javascript
function timeConverter(timestamp) {
    const a = new Date(timestamp);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const year = a.getFullYear();
    const month = months[a.getMonth()];
    const date = a.getDate();
    const hour = a.getHours();
    let min = a.getMinutes();
    if (min < 10)
        min = "0" + min;
    return hour + ':' + min + ' ' + month + ' ' + date + ', ' + year;
}
